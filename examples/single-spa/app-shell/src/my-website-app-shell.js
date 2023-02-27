import {
  constructRoutes,
  constructApplications,
  constructLayoutEngine,
} from "single-spa-layout";
import { registerApplication, start } from "single-spa";
import { ImportsMapGenerator } from "./importmap-generator";

const ENDPOINT = process.env.DISCOVERY_ENDPOINT;
const LINKS = ["my-website/home", "my-website/about-us"];

let MFEs;

const discover = async (config) => {
  if (!config.endpoint) {
    throw new Error("No endpoint provided");
  }

  const req = { credentials: "include" };

  if (config.headers) {
    req.headers = config.headers;
  }

  const res = await fetch(config.endpoint, req);
  const json = await res.json();
  return json;
};

const init = async () => {
  const dynamicMap = new ImportsMapGenerator();
  MFEs = await discover({ endpoint: ENDPOINT });
  const routesList = [];

  LINKS.forEach((link) => {
    const [project, mfeName] = link.split("/");
    const mfe = MFEs.microFrontends[link][0];
    routesList.push({
      type: "route",
      path: mfeName,
      routes: [{ type: "application", name: `@${link}` }],
    });
    dynamicMap.addImport(link, mfe.url);
  });

  await dynamicMap.appendToHead();

  const routes = constructRoutes({ routes: routesList });
  const applications = constructApplications({
    routes,
    loadApp: ({ name }) => System.import(name),
  });

  const layoutEngine = constructLayoutEngine({
    routes,
    applications,
    active: true,
  });

  applications.forEach(registerApplication);
  start();
};

init();
