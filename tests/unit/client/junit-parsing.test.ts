import { describe, it, expect, beforeEach } from "vitest";
import nock from "nock";
import { GoCDClient } from "@/client/gocd-client.js";
import { Config } from "@/config.js";

const config = {
    serverUrl: "https://gocd.example.com",
    apiToken: "test-token",
} as unknown as Config;

const artifactPath = "/go/files/build-pipeline/10/functional/1/php-command-2/testoutput/junit.xml";

/**
 * PHPUnit wraps everything in an unnamed root suite, nests a suite per class, and adds one more
 * level per data provider. A class-level suite can also hold plain test cases of its own.
 */
const phpunitXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="" tests="4" failures="1" errors="0" skipped="0" time="6">
    <testsuite name="command-2" tests="4" failures="1" errors="0" skipped="0" time="6">
      <testsuite name="App\\Test\\PayoutTest" tests="3" failures="1" errors="0" skipped="0" time="5">
        <testcase name="testPayout" classname="App.Test.PayoutTest" time="1"/>
        <testcase name="testRefund" classname="App.Test.PayoutTest" time="1">
          <failure type="PHPUnit\\Framework\\ExpectationFailedException">App\\Test\\PayoutTest::testRefund
Failed asserting that false is true.

/app/tests/PayoutTest.php:205</failure>
        </testcase>
        <testsuite name="testWithProvider" tests="1" failures="0" errors="0" skipped="0" time="3">
          <testcase name="testWithProvider with data set #0" classname="App.Test.PayoutTest" time="3"/>
        </testsuite>
      </testsuite>
      <testsuite name="App\\Test\\SkippedTest" tests="1" failures="0" errors="0" skipped="1" time="1">
        <testcase name="testSkipped" classname="App.Test.SkippedTest" time="1">
          <skipped/>
        </testcase>
      </testsuite>
    </testsuite>
  </testsuite>
</testsuites>`;

describe("parseJUnitXml()", () => {
    let client: GoCDClient;

    beforeEach(() => {
        client = new GoCDClient(config);
        nock.cleanAll();
    });

    const parse = () => {
        return client.parseJUnitXml(
            "test-token",
            "build-pipeline",
            10,
            "functional",
            1,
            "php-command-2",
            "testoutput/junit.xml",
        );
    };

    it("finds test cases nested several suites deep", async () => {
        nock("https://gocd.example.com").get(artifactPath).reply(200, phpunitXml);

        const results = await parse();

        expect(results.suites.map((suite) => suite.name)).toEqual([
            "App\\Test\\PayoutTest",
            "testWithProvider",
            "App\\Test\\SkippedTest",
        ]);
    });

    it("counts each test case once instead of trusting the wrapper suite attributes", async () => {
        nock("https://gocd.example.com").get(artifactPath).reply(200, phpunitXml);

        const results = await parse();

        expect(results.summary).toEqual({
            totalTests: 4,
            totalFailures: 1,
            totalErrors: 0,
            totalSkipped: 1,
            totalTime: 6,
        });
    });

    it("reports a PHPUnit failure that carries its message as element text", async () => {
        nock("https://gocd.example.com").get(artifactPath).reply(200, phpunitXml);

        const results = await parse();

        expect(results.failedTests).toHaveLength(1);
        expect(results.failedTests[0]).toMatchObject({
            suiteName: "App\\Test\\PayoutTest",
            testName: "testRefund",
            className: "App.Test.PayoutTest",
            message: "App\\Test\\PayoutTest::testRefund",
            type: "PHPUnit\\Framework\\ExpectationFailedException",
        });
        expect(results.failedTests[0].details).toContain("Failed asserting that false is true.");
    });
});
