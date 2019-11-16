const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const tokenRegex = new RegExp('%branch%', "g");

    const inputs = {
      token: core.getInput('repo-token', {required: true}),
      branchRegex: core.getInput('branch-regex', {required: true}),
      lowercaseBranch: (core.getInput('lowercase-branch').toLowerCase() === 'true'),
      titleTemplate: core.getInput('title-template', {required: true}),
      titlePrefixSpace: (core.getInput('title-prefix-space').toLowerCase() === 'true'),
      uppercaseTitle: (core.getInput('uppercase-title').toLowerCase() === 'true'),
      bodyTemplate: core.getInput('body-template', {required: true}),
      bodyPrefixNewlineCount: parseInt(core.getInput('body-prefix-newline-count', {required: true})),
      uppercaseBody: (core.getInput('uppercase-body').toLowerCase() === 'true'),
    }

    const branchRef = github.context.payload.pull_request.head.ref;
    const branchName = branchRef.substring(8, branchRef.length);
    const branch = inputs.lowercaseBranch ? branchName.toLowerCase() : branchName;
    core.debug(`branch: ${branch}`);

    const matches = branch.match(new RegExp(inputs.branchRegex));
    if (!matches) {
      core.setFailed('Branch name does not match given regex');
      return;
    }

    const match = (upperCase) => upperCase ? matches[0].toUpperCase() : matches[0];
    core.info(`Matched branch text: ${match(false)}`);

    const request = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: github.context.payload.pull_request.number,
    }

    const titlePrefix = inputs.titleTemplate.replace(tokenRegex, match(inputs.uppercaseTitle));
    core.debug(`titlePrefix: ${titlePrefix}`);

    const title = github.context.payload.pull_request.title;
    const updateTitle = !title.toLowerCase().startsWith(titlePrefix.toLowerCase());

    if (updateTitle) {
      request.title = titlePrefix.concat(inputs.titlePrefixSpace ? ' ': '', title);
      core.debug(`new title: ${request.title}`);
    } else {
      core.warning('PR title is prefixed already - no updates made');
    }

    const bodyPrefix = inputs.bodyTemplate.replace(tokenRegex, match(inputs.uppercaseBody));
    core.debug(`bodyPrefix: ${bodyPrefix}`);

    const body = github.context.payload.pull_request.body;
    const updateBody = !body.toLowerCase().startsWith(bodyPrefix.toLowerCase());

    if (updateBody) {
      request.body = bodyPrefix.concat('\n'.repeat(inputs.bodyPrefixNewlineCount), body);
      core.debug(`new body: ${request.body}`);
    } else {
      core.warning('PR body is prefixed already - no updates made');
    }

    if (!updateTitle && !updateBody) {
      return;
    }

    const client = new github.GitHub(inputs.token);
    const response = await client.pulls.update(request);

    core.info(`response: ${response.status}`);
    if (response.status !== 200) {
      core.error('Updating the pull request has failed');
    }
  }
  catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

run()
