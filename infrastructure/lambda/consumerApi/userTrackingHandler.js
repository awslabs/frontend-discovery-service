import { v4 as uuidv4 } from "uuid";

const userTrackingHandler = (cookieSettings) => {
  return {
    before: async (request) => {
      const event = request.event;
      let cookies = event.headers.Cookie ? event.headers.Cookie.split(";") : [];
      let userId;

      cookies.forEach((cookie) => {
        const [cookieName, value] = cookie.trim().split("=");
        if (cookieName == "USER_TOKEN") userId = value;
      });

      event.createUserCookie = !userId;
      event.userId = userId || uuidv4();
    },
    after: async (request) => {
      const event = request.event;
      if (event.createUserCookie) {
        request.response.headers = request.response.headers || {};
        let newCookie = `USER_TOKEN=${event.userId}`;
        if (cookieSettings.trim() !== "") {
          newCookie += `; ${cookieSettings}`;
        }
        request.response.headers["Set-Cookie"] = newCookie;
      }
    },
  };
};

export default userTrackingHandler;
