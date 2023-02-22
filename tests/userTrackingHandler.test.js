import userTrackingHandler from "../infrastructure/lambda/consumerApi/userTrackingHandler";
import { v4 as uuidv4 } from "uuid";

jest.mock("uuid");

const uuidStub = "81149c12-8c00-4ec2-9c03-cca5f1def455";
const USER_TOKEN = "USER_TOKEN";

test("before event applies user id in header", async () => {
  const userId = "123";
  const request = {
    event: {
      headers: {
        Cookie: `${USER_TOKEN}=${userId}`,
      },
    },
    response: {},
  };
  await userTrackingHandler().before(request);
  expect(request.event.userId).toEqual(userId);
  expect(request.event.createUserCookie).toEqual(false);
});

test("before event creates new user id if not in header", async () => {
  uuidv4.mockReturnValueOnce(uuidStub);
  const request = {
    event: {
      headers: {},
    },
    response: {},
  };
  await userTrackingHandler().before(request);
  expect(request.event.userId).toEqual(uuidStub);
  expect(request.event.createUserCookie).toEqual(true);
});

test("after event sets set-cookie header with user id", async () => {
  const userId = "123";
  const request = {
    event: {
      userId,
      createUserCookie: true,
    },
    response: {},
  };
  await userTrackingHandler("").after(request);
  expect(request.response.headers["Set-Cookie"]).toEqual(
    `USER_TOKEN=${userId}`
  );
});

test("after event sets set-cookie header with user id and extra settings", async () => {
  const userId = "123";
  const request = {
    event: {
      userId,
      createUserCookie: true,
    },
    response: {},
  };
  await userTrackingHandler("Secure;SameSite=None").after(request);
  expect(request.response.headers["Set-Cookie"]).toEqual(
    `USER_TOKEN=${userId}; Secure;SameSite=None`
  );
});

test("after event doesn't set-cookie header if user was already present", async () => {
  const userId = "123";
  const request = {
    event: {
      userId,
      createUserCookie: false,
    },
    response: {},
  };
  await userTrackingHandler("").after(request);
  expect(request.response.headers).toBeUndefined();
});
