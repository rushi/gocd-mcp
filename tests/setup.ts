import { afterEach } from "vitest";
import nock from "nock";

afterEach(() => {
    nock.cleanAll();
});
