import { getStates } from "../infrastructure/lambda/cicd/deployment";

const mfe = require("./stubs/mfe.json");

test("it processes a deploy strategy with integer increment", () => {
  const strategy = { increment: 5 };
  const states = getStates(mfe, "2.0.0", strategy);
  expect(states.length).toEqual(((100 / strategy.increment) >> 0) + 1);
});

test("it processes a deploy strategy with array increment", () => {
  const strategy = { increment: [10, 90] };
  const states = getStates(mfe, "2.0.0", strategy);
  expect(states.length).toEqual(strategy.increment.length + 1);
});
