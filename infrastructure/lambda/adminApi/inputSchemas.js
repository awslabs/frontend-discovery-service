export default {
  patchProject: {
    type: "object",
    properties: {
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  patchMFE: {
    type: "object",
    properties: {
      body: {
        type: "object",
        properties: {
          name: { type: "string" },
          default: { type: "string" },
          activeVersions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                version: { type: "string" },
                traffic: { type: "integer" },
              },
              required: ["version", "traffic"],
            },
          },
        },
        additionalProperties: false,
      },
    },
  },
  postMFEVersion: {
    type: "object",
    properties: {
      body: {
        type: "object",
        properties: {
          version: {
            type: "object",
            properties: {
              url: { type: "string" },
              fallbackUrl: { type: "string" },
              metadata: {
                type: "object",
                properties: {
                  integrity: {
                    type: "string",
                  },
                  version: {
                    type: "string",
                  },
                },
                required: ["integrity", "version"],
              },
              extras: {
                type: "object",
              },
            },
            required: ["url", "metadata"],
          },
          deploymentStrategy: {
            type: "string",
            enum: [
              "Linear10PercentEvery10Minutes",
              "Linear10PercentEvery1Minute",
              "Linear10PercentEvery2Minutes",
              "Linear10PercentEvery3Minutes",
              "Canary10Percent30Minutes",
              "Canary10Percent5Minutes",
              "Canary10Percent10Minutes",
              "Canary10Percent15Minutes",
              "AllAtOnce"
            ],
          },
        },
        required: ["version"],
      },
    },
  },
  postDeployment: {
    type: "object",
    properties: {
      body: {
        type: "object",
        properties: {
          targetVersion: { type: "string" },
          deploymentStrategy: {
            type: "string",
            enum: [
              "Linear10PercentEvery10Minutes",
              "Linear10PercentEvery1Minute",
              "Linear10PercentEvery2Minutes",
              "Linear10PercentEvery3Minutes",
              "Canary10Percent30Minutes",
              "Canary10Percent5Minutes",
              "Canary10Percent10Minutes",
              "Canary10Percent15Minutes",
              "AllAtOnce"
            ],
          },
        },
        required: ["targetVersion", "deploymentStrategy"],
      },
    },
  },
};
