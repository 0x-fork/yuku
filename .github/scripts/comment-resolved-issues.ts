interface Issue {
  number: number;
  repository: { nameWithOwner: string };
}

interface PullRequest {
  number: number;
  merged: boolean;
  mergeCommit: { oid: string } | null;
  closingIssuesReferences: { nodes: Issue[] };
}

interface CommitQuery {
  data?: {
    repository: {
      object: { associatedPullRequests: { nodes: PullRequest[] } } | null;
    };
  };
  errors?: { message: string }[];
}

interface IssueComment {
  body: string;
}

const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA, PACKAGE_URL } = process.env;

if (!GITHUB_REPOSITORY || !GITHUB_SHA || !PACKAGE_URL) {
  console.error("GITHUB_REPOSITORY, GITHUB_SHA, and PACKAGE_URL must be set");
  process.exit(1);
}

const api = "https://api.github.com";
const headers = {
  authorization: `Bearer ${GITHUB_TOKEN}`,
  accept: "application/vnd.github+json",
  "content-type": "application/json",
};

// a squash, rebase, or merge commit is the merge commit of the pull request that landed it
const query = `
  query ($owner: String!, $name: String!, $sha: GitObjectID!) {
    repository(owner: $owner, name: $name) {
      object(oid: $sha) {
        ... on Commit {
          associatedPullRequests(first: 5) {
            nodes {
              number
              merged
              mergeCommit { oid }
              closingIssuesReferences(first: 20) {
                nodes { number repository { nameWithOwner } }
              }
            }
          }
        }
      }
    }
  }
`;

const [owner, name] = GITHUB_REPOSITORY.split("/");
const response = await fetch(`${api}/graphql`, {
  method: "POST",
  headers,
  body: JSON.stringify({ query, variables: { owner, name, sha: GITHUB_SHA } }),
});
if (!response.ok) {
  console.error(`cannot query ${GITHUB_SHA} (${response.status}): ${await response.text()}`);
  process.exit(1);
}

const result = (await response.json()) as CommitQuery;
if (result.errors !== undefined || result.data === undefined) {
  console.error(`cannot query ${GITHUB_SHA}: ${JSON.stringify(result.errors)}`);
  process.exit(1);
}

const pull = result.data.repository.object?.associatedPullRequests.nodes.find(
  (candidate) => candidate.merged && candidate.mergeCommit?.oid === GITHUB_SHA,
);
if (pull === undefined) {
  console.log(`${GITHUB_SHA} landed without a pull request, no issues to comment on`);
  process.exit(0);
}

// the token can only comment in this repository
const issues = pull.closingIssuesReferences.nodes.filter(
  (issue) => issue.repository.nameWithOwner === GITHUB_REPOSITORY,
);
if (issues.length === 0) {
  console.log(`#${pull.number} resolves no issues in ${GITHUB_REPOSITORY}`);
  process.exit(0);
}

// the playground loads only a commit hash
const sha = /@([0-9a-f]{7,40})$/.exec(PACKAGE_URL)?.[1];
if (sha === undefined) {
  console.error(`the preview package URL ${PACKAGE_URL} does not end in a commit hash`);
  process.exit(1);
}

const playground = `https://playground.yuku.fyi/?pr=${sha}`;
const marker = `<!-- resolved-in #${pull.number} -->`;
const body = [
  marker,
  `Resolved in #${pull.number}. It will be part of the next release of Yuku.`,
  "",
  "To use it now, install a preview build that includes it:",
  "",
  "```sh",
  `npm i ${PACKAGE_URL}`,
  "```",
  "",
  `Or try it in the [playground](${playground}), with nothing to install.`,
  "",
  "<sub>Preview builds are hosted on [pkg.pr.new](https://pkg.pr.new), not npm. " +
    "Once the release is out, switch back with `npm i yuku`.</sub>",
].join("\n");

let failed = false;
for (const issue of issues) {
  const comments = `${api}/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments`;

  const listed = await fetch(`${comments}?per_page=100`, { headers });
  if (!listed.ok) {
    const reason = await listed.text();
    console.error(`cannot list comments on #${issue.number} (${listed.status}): ${reason}`);
    failed = true;
    continue;
  }

  // a rerun of the workflow must not comment twice
  const commented = ((await listed.json()) as IssueComment[]).some((comment) =>
    comment.body.startsWith(marker),
  );
  if (commented) {
    console.log(`#${issue.number} already has the comment for #${pull.number}`);
    continue;
  }

  const posted = await fetch(comments, {
    method: "POST",
    headers,
    body: JSON.stringify({ body }),
  });
  if (!posted.ok) {
    const reason = await posted.text();
    console.error(`cannot comment on #${issue.number} (${posted.status}): ${reason}`);
    failed = true;
    continue;
  }
  console.log(`commented on #${issue.number} for #${pull.number}`);
}

if (failed) process.exit(1);
