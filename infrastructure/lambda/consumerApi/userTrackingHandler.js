import { v4 as uuidv4 } from "uuid";

const userTrackingHandler = () => {
  return {
    before: async (request) => {
      const event = request.event;
      let cookies = event.headers.Cookie ? event.headers.Cookie.split(";") : [];
      let userId;

      cookies.forEach((cookie) => {
        const [cookieName, value] = cookie.trim().split("=");
        if (cookieName == "USER_TOKEN") userId = value;
      });

      event.userId = userId || uuidv4();
    },
    after: async (request) => {
      request.response.headers = request.response.headers || {};
      request.response.headers[
        "Set-Cookie"
      ] = `USER_TOKEN=${request.event.userId}`;
    },
  };
};

export default userTrackingHandler;
