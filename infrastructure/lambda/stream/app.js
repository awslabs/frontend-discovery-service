import { DynamoDB } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  PutCommand,
  BatchWriteCommand,
  UpdateCommand,
  DeleteCommand,
  paginateQuery,
} from "@aws-sdk/lib-dynamodb";

import { Metrics } from "@aws-lambda-powertools/metrics";
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";

const metrics = new Metrics();
const logger = new Logger();
const tracer = new Tracer();

const dynamoClient = tracer.captureAWSv3Client(
  new DynamoDB({ region: process.env.REGION })
);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const DYNAMO_BATCH_SIZE = 25;

export const handler = async (event) => {
  for (const record of event.Records) {
    await processRecord(record);
  }
};

const processRecord = async (record) => {
  const sourceTable = record.eventSourceARN.split("/")[1];
  const isProject = sourceTable === process.env.PROJECT_STORE;
  const isFrontend = sourceTable === process.env.FRONTEND_STORE;

  if (isProject && ["MODIFY", "INSERT"].includes(record.eventName))
    await handleUpdateProject(record);
  else if (isFrontend && ["MODIFY", "INSERT"].includes(record.eventName))
    await handleUpdateFrontend(record);
  else logger.warn("Unhandled record", record);
};

export const handleUpdateProject = async (record) => {
  logger.debug("handleUpdateProject", record);
  const projectId = record.dynamodb.Keys.projectId.S;

  if (record.dynamodb.NewImage.deleted?.BOOL) {
    await handleDeleteProject(record);
  } else {
    const views = await getConsumerViewsUnpaginated(projectId);
    for (let i = 0; i < views.length; i += DYNAMO_BATCH_SIZE) {
      const chunk = views.slice(i, i + DYNAMO_BATCH_SIZE);
      const params = {
        RequestItems: {
          [process.env.CONSUMER_STORE]: chunk.map((item) => {
            const newItem = {
              ...item,
              ...{ projectName: record.dynamodb.NewImage.name.S },
            };
            return {
              PutRequest: {
                Item: newItem,
              },
            };
          }),
        },
      };
      await docClient.send(new BatchWriteCommand(params));
    }
  }
};

const handleDeleteProject = async (record) => {
  logger.debug("handleDeleteProject", record);
  const projectId = record.dynamodb.Keys.projectId.S;
  const expiry = parseInt(record.dynamodb.NewImage.expiresAt.N) + 3600;

  // delete all entries from the consumer store
  const views = await getConsumerViewsUnpaginated(projectId);
  for (let i = 0; i < views.length; i += DYNAMO_BATCH_SIZE) {
    const chunk = views.slice(i, i + DYNAMO_BATCH_SIZE);
    const params = {
      RequestItems: {
        [process.env.CONSUMER_STORE]: chunk.map((item) => {
          return {
            DeleteRequest: {
              Key: {
                projectId: item.projectId,
                microFrontendId: item.microFrontendId,
              },
            },
          };
        }),
      },
    };
    await docClient.send(new BatchWriteCommand(params));
  }

  // mark frontend store items as deleted
  const frontends = await getFrontendsUnpaginated(projectId);
  for (let i = 0; i < frontends.length; i += DYNAMO_BATCH_SIZE) {
    const chunk = frontends.slice(i, i + DYNAMO_BATCH_SIZE);
    const params = {
      RequestItems: {
        [process.env.FRONTEND_STORE]: chunk.map((item) => {
          const newItem = {
            ...item,
            ...{ expiresAt: expiry, deleted: true, deleteMode: "project" },
          };
          return {
            PutRequest: {
              Item: newItem,
            },
          };
        }),
      },
    };
    await docClient.send(new BatchWriteCommand(params));
  }

  // mark all entries from the version store as deleted
  for (const frontend of frontends) {
    await markVersionsDeleted(frontend.microFrontendId, expiry + 3600);
  }
};

export const handleUpdateFrontend = async (record) => {
  if (record.dynamodb.NewImage.deleteMode?.S === "project") {
    return;
  } else if (record.dynamodb.NewImage.deleted?.BOOL) {
    await handleDeleteFrontend(record);
    return;
  } else if (record.dynamodb.NewImage.activeVersions.L.length === 0) {
    return;
  }

  logger.debug("handleUpdateFrontend", record);

  const projectId = record.dynamodb.Keys.projectId.S;
  const microFrontendId = record.dynamodb.Keys.microFrontendId.S;

  const view = await generateView(projectId, microFrontendId);
  const params = {
    TableName: process.env.CONSUMER_STORE,
    Item: view,
  };
  await docClient.send(new PutCommand(params));
};

const handleDeleteFrontend = async (record) => {
  logger.debug("handleDeleteFrontend", record);

  const projectId = record.dynamodb.Keys.projectId.S;
  const microFrontendId = record.dynamodb.Keys.microFrontendId.S;

  const expiry = parseInt(record.dynamodb.NewImage.expiresAt.N) + 3600;
  await docClient.send(
    new DeleteCommand({
      TableName: process.env.CONSUMER_STORE,
      Key: { projectId: projectId, microFrontendId: microFrontendId },
    })
  );

  await markVersionsDeleted(microFrontendId, expiry, "mfe");
};

const markVersionsDeleted = async (
  microFrontendId,
  expiry,
  deleteMode = "project"
) => {
  const versions = await getVersionsUnpaginated(microFrontendId);

  for (let i = 0; i < versions.length; i += DYNAMO_BATCH_SIZE) {
    const chunk = versions.slice(i, i + DYNAMO_BATCH_SIZE);
    const params = {
      RequestItems: {
        [process.env.VERSION_STORE]: chunk.map((item) => {
          const newItem = {
            ...item,
            ...{ expiresAt: expiry, deleted: true, deleteMode: deleteMode },
          };
          return {
            PutRequest: {
              Item: newItem,
            },
          };
        }),
      },
    };
    await docClient.send(new BatchWriteCommand(params));
  }
};

export const getProjectById = async (projectId) => {
  const params = {
    KeyConditionExpression: "projectId = :project",
    ExpressionAttributeValues: {
      ":project": projectId,
    },
    TableName: process.env.PROJECT_STORE,
  };
  const result = await docClient.send(new QueryCommand(params));
  if (result.Items.length == 0) throw new createError.NotFound();

  return result.Items[0];
};

export const getFrontendById = async (projectId, microFrontendId) => {
  let params = {
    KeyConditionExpression:
      "projectId = :project And microFrontendId = :microFrontendId",
    ExpressionAttributeValues: {
      ":project": projectId,
      ":microFrontendId": microFrontendId,
    },
    TableName: process.env.FRONTEND_STORE,
  };

  const result = await docClient.send(new QueryCommand(params));
  if (result.Items.length == 0) throw new createError.NotFound();

  return result.Items[0];
};

export const getVersion = async (microFrontendId, version) => {
  let params = {
    KeyConditionExpression:
      "microFrontendId = :microFrontendId And version = :v",
    ExpressionAttributeValues: {
      ":microFrontendId": microFrontendId,
      ":v": version,
    },
    TableName: process.env.VERSION_STORE,
  };

  const result = await docClient.send(new QueryCommand(params));
  if (result.Items.length == 0)
    throw new createError.NotFound("The specified version could not be found.");
  return result.Items[0];
};

export const generateView = async (projectId, microFrontendId) => {
  const promises = [
    getProjectById(projectId),
    getFrontendById(projectId, microFrontendId),
  ];
  const [project, microFrontend] = await Promise.all(promises);

  let view = {
    projectId: projectId,
    microFrontendId: microFrontendId,
    projectName: project.name,
    mfeName: microFrontend.name,
  };

  if (!microFrontend.activeVersions) return view;
  view.versions = [];

  for (const activeVersion of microFrontend.activeVersions) {
    const version = await getVersion(microFrontendId, activeVersion.version);
    view.versions.push({
      ...version.data,
      ...{
        deployment: {
          traffic: activeVersion.traffic,
          default: microFrontend.default === activeVersion.version,
        },
      },
    });
  }

  return view;
};

export const getFrontendsUnpaginated = async (projectId) => {
  let result = [];

  let params = {
    KeyConditionExpression: "projectId = :project",
    ExpressionAttributeValues: {
      ":project": projectId,
    },
    TableName: process.env.FRONTEND_STORE,
  };

  for await (const page of paginateQuery({ client: docClient }, params)) {
    result.push(...page.Items);
  }

  return result;
};

export const getConsumerViewsUnpaginated = async (projectId) => {
  let result = [];

  let params = {
    KeyConditionExpression: "projectId = :project",
    ExpressionAttributeValues: {
      ":project": projectId,
    },
    TableName: process.env.CONSUMER_STORE,
  };

  for await (const page of paginateQuery({ client: docClient }, params)) {
    result.push(...page.Items);
  }

  return result;
};

export const getVersionsUnpaginated = async (microFrontendId) => {
  let result = [];

  let params = {
    KeyConditionExpression: "microFrontendId = :microFrontendId",
    ExpressionAttributeValues: {
      ":microFrontendId": microFrontendId,
    },
    TableName: process.env.VERSION_STORE,
  };

  for await (const page of paginateQuery({ client: docClient }, params)) {
    result.push(...page.Items);
  }

  return result;
};
