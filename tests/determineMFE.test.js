import determineMFE, {
  hashCode,
} from "../infrastructure/lambda/consumerApi/determineMFE";
import { v4 as uuidv4 } from "uuid";

const view = require("./stubs/consumerView.json");
const viewDeployment = require("./stubs/consumerViewDeployment.json");

const logger = { error: jest.fn() };

test("hashCode returns same value each time", () => {
  const id = uuidv4();
  expect(hashCode(id)).toEqual(hashCode(id));
});

test("user is assigned the same mfe version each time", () => {
  const user = uuidv4();
  expect(determineMFE({}, logger, viewDeployment, user)).toEqual(
    determineMFE({}, logger, viewDeployment, user)
  );
});

test("it returns the latest version if no deployment", () => {
  const result = determineMFE({}, logger, view, uuidv4());
  expect(result).toStrictEqual(view.versions.find((v) => v.deployment.default));
});

test("it returns the latest version if any issue happens during assignment", () => {
  const clonedView = JSON.parse(JSON.stringify(view));
  clonedView.versions[1] = {}; // no metadata

  const result = determineMFE({}, logger, clonedView, uuidv4());
  expect(result).toStrictEqual(view.versions.find((v) => v.deployment.default));
  expect(logger.error).toHaveBeenCalledTimes(2);
});

test("distribution over time matches deployment configuration", () => {
  const allowance = 5;
  const iterations = 10000;
  const percentageDivider = iterations / 100;

  let expectedMap = {};
  viewDeployment.versions.forEach(
    (version) =>
      (expectedMap[version.metadata.version] = version.deployment.traffic)
  );

  let results = [];
  for (let index = 0; index < iterations; index++) {
    const user = uuidv4();
    const result = determineMFE({}, logger, viewDeployment, user);
    results.push(result.metadata.version);
  }

  const counts = {};
  for (const num of results) {
    counts[num] = counts[num] ? counts[num] + 1 : 1;
  }

  for (let version of Object.keys(expectedMap)) {
    let expectedPercentage = expectedMap[version];
    expect(counts[version] / percentageDivider).toBeGreaterThan(
      expectedPercentage - allowance
    );
    expect(counts[version] / percentageDivider).toBeLessThan(
      expectedPercentage + allowance
    );
  }
});
