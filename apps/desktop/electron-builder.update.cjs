const base = require("./package.json").build;

const url = process.env.MANGAI_UPDATE_URL;
if (!url) throw new Error("MANGAI_UPDATE_URL is required.");

const repository = process.env.GITHUB_REPOSITORY?.split("/");
const channel = process.env.MANGAI_RELEASE_CHANNEL || "stable";
if (!["stable", "beta"].includes(channel))
  throw new Error("MANGAI_RELEASE_CHANNEL must be stable or beta.");
const publish =
  repository?.length === 2
    ? [
        {
          provider: "github",
          owner: repository[0],
          repo: repository[1],
          tagNamePrefix: "desktop-v",
          releaseType: "draft",
          channel: channel === "beta" ? "beta" : "latest",
        },
      ]
    : [
        {
          provider: "generic",
          url,
          channel: channel === "beta" ? "beta" : "latest",
        },
      ];

module.exports = {
  ...base,
  forceCodeSigning: process.env.MANGAI_REQUIRE_SIGNING === "1",
  publish,
};
