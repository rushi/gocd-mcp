import createDebug from "debug";

const NAMESPACE = "gocd-mcp";

export const debug = {
    server: createDebug(`${NAMESPACE}:server`),
    http: createDebug(`${NAMESPACE}:http`),
    tools: createDebug(`${NAMESPACE}:tools`),
    client: createDebug(`${NAMESPACE}:client`),
    session: createDebug(`${NAMESPACE}:session`),
};
