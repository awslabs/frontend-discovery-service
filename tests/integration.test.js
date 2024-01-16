import {
  CloudFormationClient,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  UpdateUserPoolClientCommand,
  AdminInitiateAuthCommand,
  AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import request from "supertest";
const cognito = new CognitoIdentityProviderClient();

const username = "aws-uk-sa-builders@amazon.com";
const pwd = "!Acceptance1Tests2password!";
let userPoolId;
let adminApiEndpoint;
let consumerEndpoint;
let project = {};
let mfe = {};
let deploymentId;
let firstVersionReceived;
let userToken;
let authToken;

const mfeVersion1 = {
  url: "https://static.example.com/my-account-1.0.0.js",
  fallbackUrl: "https://alt-cdn.com/my-account-1.0.0.js",
  metadata: {
    integrity: "e0d123e5f316bef78bfdf5a008837577",
    version: "1.0.0",
  },
};

const mfeVersion2 = {
  url: "https://static.example.com/my-account-2.0.0.js",
  fallbackUrl: "https://alt-cdn.com/my-account-2.0.0.js",
  metadata: {
    integrity: "e0d123e5f316bef78bfdf5a008837600",
    version: "2.0.0",
  },
};

const testIf = (condition, ...args) =>
  condition ? test(...args) : test.skip(...args);

const runIntegrationTests = process.env.STACK_NAME;

beforeAll(async () => {
  if (!runIntegrationTests) {
    console.log("Skipping integration tests. Set STACK_NAME to run the tests.");
    return;
  }

  const cloudformation = new CloudFormationClient();

  const stack = await cloudformation.send(
    new DescribeStacksCommand({ StackName: process.env.STACK_NAME })
  );

  adminApiEndpoint = stack.Stacks[0].Outputs.find(
    (o) => o.OutputKey == "AdminApi"
  ).OutputValue;
  consumerEndpoint = stack.Stacks[0].Outputs.find(
    (o) => o.OutputKey == "ConsumerApi"
  ).OutputValue;
  userPoolId = stack.Stacks[0].Outputs.find(
    (o) => o.OutputKey == "CognitoUserPoolID"
  ).OutputValue;
  const clientId = stack.Stacks[0].Outputs.find(
    (o) => o.OutputKey == "CognitoWebClientID"
  ).OutputValue;

  // create user
  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username,
      TemporaryPassword: pwd,
      MessageAction: "SUPPRESS",
    })
  );

  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: pwd,
      Permanent: true,
    })
  );

  // allow admin login
  await cognito.send(
    new UpdateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      ExplicitAuthFlows: [
        "ALLOW_ADMIN_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
      ],
    })
  );

  // get jwt token for user
  const loginResponse = await cognito.send(
    new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: username,
        PASSWORD: pwd,
      },
    })
  );

  authToken = loginResponse.AuthenticationResult.IdToken;
});

afterAll(async () => {
  await cognito.send(
    new AdminDeleteUserCommand({
      UserPoolId: userPoolId,
      Username: username,
    })
  );
});

describe("unauthenticated requests", () => {
  const endpoints = [
    ["post", "/projects", { name: "my-project" }],
    ["patch", "/projects/123456789asdfghjkl", { name: "my-project-123" }],
    ["delete", "/projects/123456789asdfghjkl"],
    ["get", "/projects"],
    [
      "post",
      "/projects/123456789asdfghjkl/microFrontends",
      { name: "catalog" },
    ],
    ["get", "/projects/123456789asdfghjkl/microFrontends"],
    [
      "patch",
      "/projects/123456789asdfghjkl/microFrontends/123456789000",
      { name: "catalog-123" },
    ],
    [
      "post",
      "/projects/123456789asdfghjkl/microFrontends/123456789000/versions",
      { version: mfeVersion1 },
    ],
    [
      "get",
      "/projects/123456789asdfghjkl/microFrontends/123456789000/versions",
    ],
  ];

  endpoints.forEach(([method, endpoint, payload]) => {
    testIf(
      runIntegrationTests,
      `${method} ${endpoint} should return 401`,
      async () => {
        let req = request(adminApiEndpoint)[method](endpoint);
        if (method !== "get") req = req.send(payload);
        const response = await req;
        expect(response.statusCode).toBe(401);
      }
    );
  });
});

describe("creating a project", () => {
  const projectName = "my-project";
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .post("/projects")
      .set("Authorization", authToken)
      .send({ name: projectName });

    project.id = response.body.id;
  });

  testIf(runIntegrationTests, "it should return 201", () => {
    expect(response.statusCode).toBe(201);
  });

  testIf(runIntegrationTests, "it should return the given name", () => {
    expect(response.body.name).toBe(projectName);
  });

  testIf(runIntegrationTests, "it should return an id", async () => {
    expect(response.body.id).toBeDefined();
  });
});

describe("renaming a project", () => {
  const newProjectName = "my-project-123";
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .patch(`/projects/${project.id}`)
      .set("Authorization", authToken)
      .send({ name: newProjectName });

    project.name = response.body.name;
  });

  testIf(runIntegrationTests, "it should return 200", () => {
    expect(response.statusCode).toBe(200);
  });

  testIf(runIntegrationTests, "it should return the given name", () => {
    expect(response.body.name).toBe(newProjectName);
  });

  testIf(runIntegrationTests, "should return the given id", () => {
    expect(response.body.id).toBe(project.id);
  });
});

describe("getting a list of projects", () => {
  let response;

  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .get(`/projects`)
      .set("Authorization", authToken);
  });

  testIf(runIntegrationTests, "should return 200", () => {
    expect(response.statusCode).toBe(200);
  });

  testIf(
    runIntegrationTests,
    "should return an array containing the created project",
    () => {
      const returnedProject = response.body.projects.find(
        (p) => p.id == project.id
      );
      expect(returnedProject).toBeDefined();
    }
  );
});

describe("creating a mfe", () => {
  const mfeName = "catalog";
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .post(`/projects/${project.id}/microFrontends`)
      .set("Authorization", authToken)
      .send({ name: mfeName });

    mfe.id = response.body.microFrontendId;
    mfe.name = response.body.name;
  });

  testIf(runIntegrationTests, "should return 201", () => {
    expect(response.statusCode).toBe(201);
  });

  testIf(runIntegrationTests, "should return the given name", () => {
    expect(response.body.name).toBe(mfeName);
  });

  testIf(runIntegrationTests, "should return an id", () => {
    expect(response.body.microFrontendId).toBeDefined();
  });
});

describe("updating an mfe to change the name", () => {
  const newMfeName = "catalog-123";
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .patch(`/projects/${project.id}/microFrontends/${mfe.id}`)
      .set("Authorization", authToken)
      .send({ name: newMfeName });

    mfe.name = response.body.name;
  });

  testIf(runIntegrationTests, "should return 200", () => {
    expect(response.statusCode).toBe(200);
  });

  testIf(runIntegrationTests, "should return the given name", () => {
    expect(response.body.name).toBe(newMfeName);
  });

  testIf(runIntegrationTests, "should return the given id", () => {
    expect(response.body.microFrontendId).toBe(mfe.id);
  });
});

describe("posting a new version to an mfe", () => {
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .post(`/projects/${project.id}/microFrontends/${mfe.id}/versions`)
      .set("Authorization", authToken)
      .send({ version: mfeVersion1 });
  });

  testIf(runIntegrationTests, "should return 201", () => {
    expect(response.statusCode).toBe(201);
  });

  testIf(runIntegrationTests, "should return the current verions", () => {
    expect(response.body.version).toStrictEqual(mfeVersion1);
  });
});

describe("getting a list of frontends for a project", () => {
  let response;

  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .get(`/projects/${project.id}/microFrontends`)
      .set("Authorization", authToken);
  });

  testIf(runIntegrationTests, "should return 200", () => {
    expect(response.statusCode).toBe(200);
  });

  testIf(
    runIntegrationTests,
    "should return a list containing the created frontend",
    () => {
      const expected = {
        projectId: project.id,
        microFrontends: [
          {
            name: `${project.name}/${mfe.name}`,
            id: mfe.id,
            activeVersions: [
              {
                version: mfeVersion1.metadata.version,
                traffic: 100,
              },
            ],
          },
        ],
      };
      expect(response.body).toStrictEqual(expected);
    }
  );
});

describe("posting another new version to an mfe", () => {
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .post(`/projects/${project.id}/microFrontends/${mfe.id}/versions`)
      .set("Authorization", authToken)
      .send({ version: mfeVersion2 });
  });

  testIf(runIntegrationTests, "should return 201", () => {
    expect(response.statusCode).toBe(201);
  });

  testIf(runIntegrationTests, "should return the current verions", () => {
    expect(response.body.version).toStrictEqual(mfeVersion2);
  });
});

describe("getting an mfe with versions", () => {
  let response;

  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .get(`/projects/${project.id}/microFrontends/${mfe.id}/versions`)
      .set("Authorization", authToken);
  });

  testIf(runIntegrationTests, "should return 200", () => {
    expect(response.statusCode).toBe(200);
  });

  testIf(
    runIntegrationTests,
    "should return the frontend versions created",
    () => {
      const expected = {
        projectId: project.id,
        microFrontendId: mfe.id,
        name: `${project.name}/${mfe.name}`,
        activeVersions: [
          {
            version: mfeVersion1.metadata.version,
            traffic: 100,
          },
        ],
        versions: [mfeVersion1, mfeVersion2],
      };
      expect(response.body).toStrictEqual(expected);
    }
  );
});

describe("patching an mfe active versions", () => {
  let response;
  const activeVersions = [
    { version: mfeVersion1.metadata.version, traffic: 50 },
    { version: mfeVersion2.metadata.version, traffic: 50 },
  ];
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .patch(`/projects/${project.id}/microFrontends/${mfe.id}`)
      .set("Authorization", authToken)
      .send({ activeVersions });
  });

  testIf(runIntegrationTests, "should return 200", () => {
    expect(response.statusCode).toBe(200);
  });

  testIf(runIntegrationTests, "should return the given versions", () => {
    expect(response.body.activeVersions).toStrictEqual(activeVersions);
  });

  testIf(runIntegrationTests, "should return the given id", () => {
    expect(response.body.microFrontendId).toBe(mfe.id);
  });
});

describe("getting an mfe as a consumer", () => {
  let response;

  beforeAll(async () => {
    await new Promise((r) => setTimeout(r, 1000));
    response = await request(consumerEndpoint).get(
      `/projects/${project.id}/microFrontends`
    );
  });

  testIf(runIntegrationTests, "should return 200", () => {
    expect(response.statusCode).toBe(200);
  });

  testIf(runIntegrationTests, "should return the schema", () => {
    expect(response.body.schema).toBe(
      "https://raw.githubusercontent.com/awslabs/frontend-discovery/main/schema/v1-pre.json"
    );
  });

  testIf(
    runIntegrationTests,
    "should return a single version for the created frontend",
    () => {
      const responseMFE =
        response.body.microFrontends[`${project.name}/${mfe.name}`];
      firstVersionReceived = responseMFE[0].metadata.version;
      expect(responseMFE.length).toBe(1);
    }
  );

  testIf(
    runIntegrationTests,
    "should return a set-cookie header with a user id",
    () => {
      const setCookie = response.headers["set-cookie"];
      const userCookie = setCookie.find((c) => c.startsWith("USER_TOKEN="));
      userToken = userCookie.split("=")[1];
      expect(userCookie).toBeDefined();
    }
  );
});

describe("getting an mfe as the same consumer", () => {
  let response;

  beforeAll(async () => {
    response = await request(consumerEndpoint)
      .get(`/projects/${project.id}/microFrontends`)
      .set("Cookie", [`USER_TOKEN=${userToken}`]);
  });

  testIf(
    runIntegrationTests,
    "should return the same version as the previous request",
    () => {
      const responseMFE =
        response.body.microFrontends[`${project.name}/${mfe.name}`];
      let secondVersionReceived = responseMFE[0].metadata.version;
      expect(secondVersionReceived).toBe(firstVersionReceived);
    }
  );
});

describe("reset an mfe active versions", () => {
  let response;
  const activeVersions = [
    { version: mfeVersion1.metadata.version, traffic: 100 },
  ];
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .patch(`/projects/${project.id}/microFrontends/${mfe.id}`)
      .set("Authorization", authToken)
      .send({ activeVersions });
  });

  testIf(runIntegrationTests, "should return 200", () => {
    expect(response.statusCode).toBe(200);
  });

  testIf(runIntegrationTests, "should return the given versions", () => {
    expect(response.body.activeVersions).toStrictEqual(activeVersions);
  });

  testIf(runIntegrationTests, "should return the given id", () => {
    expect(response.body.microFrontendId).toBe(mfe.id);
  });
});

describe("creating a deployment", () => {
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .post(`/projects/${project.id}/microFrontends/${mfe.id}/deployment`)
      .set("Authorization", authToken)
      .send({
        targetVersion: mfeVersion2.metadata.version,
        deploymentStrategy: "Linear10PercentEvery1Minute",
      });

    deploymentId = response.body.deploymentId;
  });

  testIf(runIntegrationTests, "should return 201", () => {
    expect(response.statusCode).toBe(201);
  });
});

describe("cancelling a deployment", () => {
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .delete(
        `/projects/${project.id}/microFrontends/${mfe.id}/deployment/${deploymentId}`
      )
      .set("Authorization", authToken);
  });

  testIf(runIntegrationTests, "should return 204", () => {
    expect(response.statusCode).toBe(204);
  });
});

describe("creating a deployment after cancelling a previous deployment", () => {
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .post(`/projects/${project.id}/microFrontends/${mfe.id}/deployment`)
      .set("Authorization", authToken)
      .send({
        targetVersion: mfeVersion2.metadata.version,
        deploymentStrategy: "AllAtOnce",
      });
  });

  testIf(runIntegrationTests, "should return 201", () => {
    expect(response.statusCode).toBe(201);
  });
});

describe("deleting a project", () => {
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .delete(`/projects/${project.id}`)
      .set("Authorization", authToken);
  });

  testIf(runIntegrationTests, "should return 202", () => {
    expect(response.statusCode).toBe(202);
  });
});

describe("deleting a non existent project", () => {
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .delete(`/projects/not-found`)
      .set("Authorization", authToken);
  });

  testIf(runIntegrationTests, "should return 404", () => {
    expect(response.statusCode).toBe(404);
  });
});

describe("deleting a non existent frontend", () => {
  let response;
  beforeAll(async () => {
    response = await request(adminApiEndpoint)
      .delete(`/projects/not-found/microFrontends/not-found`)
      .set("Authorization", authToken);
  });

  testIf(runIntegrationTests, "should return 404", () => {
    expect(response.statusCode).toBe(404);
  });
});
