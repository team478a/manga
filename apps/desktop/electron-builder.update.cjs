const base = require("./package.json").build;

const url = process.env.MANGAI_UPDATE_URL;
if (!url) throw new Error("MANGAI_UPDATE_URL is required.");

const repository = process.env.GITHUB_REPOSITORY?.split("/");
const publish =
  repository?.length === 2
    ? [
        {
          provider: "github",
          owner: repository[0],
          repo: repository[1],
          releaseType: "draft",
        },
      ]
    : [{ provider: "generic", url }];

module.exports = {
  ...base,
  forceCodeSigning: process.env.MANGAI_REQUIRE_SIGNING === "1",
  publish,
};
