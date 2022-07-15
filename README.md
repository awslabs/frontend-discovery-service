# Frontend Service Discovery

This repo is a place to discuss and track changes for the Frontend Service Discovery project.

TODO: What is the project about?

**Jump to**: [What is an RFC?](#what-is-an-rfc) |
[When to submit?](#when-to-submit-an-rfc) |
[RFC Process](#rfc-process) |
[RFC Life Cycle](#the-rfc-life-cycle)

<!--BEGIN_TABLE-->

| \#                                                                  | Title                                                                             | Owner                                              | Status      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- | ----------- |
| [1](https://github.com/awslabs/frontend-service-discovery/issues/1) | [Project Tenants](https://github.com/awslabs/frontend-service-discovery/issues/1) | [@lucamezzalira](https://github.com/lucamezzalira) | 💡 proposed |

<!--END_TABLE-->

## What is an RFC?

An RFC is a document that proposes a change to the project. _Request for Comments_ means a request for discussion and
oversight about the future of the project from maintainers, contributors and
users.

**When should I write an RFC?**

The team proactively decides to write RFCs for every feature.
Quite often, even changes that seem obvious
and simple at first sight can be significantly improved once a wider group of
interested and experienced people have a chance to weigh in.

**Who should submit an RFC?**

An RFC can be submitted by anyone. In most cases,
RFCs are authored by project maintainers, but contributors are more than welcome to submit RFCs.

## RFC Process

To start an RFC process, create a [new tracking issue] and follow the
instructions in the issue template. It includes a checklist of the various
stages an RFC goes through.

[new tracking issue]: https://github.com/awslabs/frontend-service-discovery/issues/new?assignees=&labels=management%2Ftracking%2C+status%2Fproposed&template=tracking-issue.md&title=proposal+title

This section describes each stage in detail, so you can refer to it for
guidance.

### 1. Tracking Issue

Each RFC has a GitHub issue which tracks it from start to finish. The issue is
the hub for conversations, community signal (+1s) and the issue number is used
as the unique identifier of this RFC.

> Before creating a tracking issue, please search for similar or related ideas in
> the RFC table above or in the issue list of this repo. If there is a relevant
> RFC, collaborate on that existing RFC, based on its current stage.

Our [tracking issue template] includes a checklist of all the steps an RFC goes
through and it's the driver's responsibility to update the checklist and assign
the correct label to on the RFC throughout the process.

[tracking issue template]: https://github.com/awslabs/frontend-service-discovery/blob/master/.github/ISSUE_TEMPLATE/tracking-issue.md

When the issue is created, it is required to fill in the following information:

1. **Title**: the name of the feature or change - think changelog entry.
2. **Description**: a _short_ description of feature, as if it was already implemented.
3. **Proposed by**: fill in the GitHub alias of the person who proposed the idea
   under "Proposed by".

### 2. RFC Document

The next step is to write the first revision of the RFC document itself.

Create a file under `text/NNNN-name.md` based off of the template under
[`0000-template.md`](./0000-template.md) (where `NNNN` is your tracking issue
number). Follow the template. It includes useful guidance and tips on how to
write a good RFC.

**What should be included in an RFC?**

The purpose of an RFC is to reduce
ambiguity and risk and get approval for public-facing interfaces (APIs), which
are "one-way doors" after the feature is released. Another way to think about it
is that the goal and contents of the document should allow us to create a
_high-confidence_ implementation plan for a feature or a change.

In many cases, it is useful to develop a **prototype** or even start coding the
actual implementation while you are writing the RFC document. Take into account
that you may need to throw your code away or refactor it substantially, but our
experience shows that good RFCs are the ones who dive into the details. A
prototype is great way to make sure your design "holds water".

### 3. Feedback

Once you have an initial version of your RFC document (it is completely fine to
submit an unfinished RFC to get initial feedback), submit it as a pull request
against this repo and start collecting feedback.

This is the likely going to be the longest part of your RFC process, and where
most of the feedback is collected. Some RFCs resolve quickly and some can take
months (!!). _Take into account at least 1-2 weeks to allow community and
stakeholders to provide their feedback._

A few tips:

- If you decide to resolve a comment without addressing it, take the time to
  explain.
- Try to understand where people are coming from. If a comment seems off, ask
  folks to elaborate and describe their use case or provide concrete examples.
- Work with your API bar raiser: if there are disagreements, @mention them in a
  comment and ask them to provide their opinion.
- Be patient: it sometimes takes time for an RFC to converge. Our experience
  shows that some ideas need to "bake" and solutions oftentimes emerge via a
  healthy debate. We've had RFCs that took months to resolve.
- Not everything must be resolved in the first revision. It is okay to leave
  some things to resolve later. Make sure to capture them clearly and have an
  agreement about that. We oftentimes update an RFC doc a few times during the
  implementation.

### 4. API Sign-off

Before you can merge your RFC, you will need the core team to sign-off on
the public API of your feature. This is will normally be described under the
**Working Backwards** section of your RFC.

To sign-off, the core team will add the **api-approved** label to the RFC
pull request.

Once the API was signed-off, update your RFC document and add a `[x]` the
relevant location in the RFC document. For example:

```
[x] Signed-off by Core team @foobar
```

### 5. Final Comments Period

At some point, you've reached consensus about most issues that were brought up
during the review period, and you are ready to merge. To allow "last call" on
feedback, the author can announce that the RFC enters "final comments period",
which means that within a ~week, if no major concerns are raised, the RFC will
be approved and merged.

Add a comment on the RFC pull request, tracking issue (and possibly slack/email
if relevant) that the RFC entered this stage so that all relevant stakeholders
will be notified.

Once the final comments period is over, seek an approval of one of the core team
members, and you can merge your PR to the main branch. This will move your RFC
to the "approved" state.

### 6. Implementation

For large changes, we highly recommend creating an implementation plan which
lists all the tasks required. In many cases, large implementation should be
broken down and released via multiple iterations. Devising a concrete plan to
break down the break can be very helpful.

The implementation plan should be submitted through a PR that adds an addendum
to the RFC document and seeks the approval of any relevant stakeholders.

Throughout this process, update the tracking issue:

- Add the alias of the "implementation lead"
- Execution plan submitted (label: `status/planning`)
- Plan approved and merged (label: `status/implementing`)
- Implementation complete (label: `status/done`)

## State Diagram

The following state diagram describes the RFC process:

![rfc-states](./images/lifecycle.png)

<!--
digraph states {
    node [shape=ellipse];
    edge [color=gray, fontsize=12]

    idea [label = "Idea", shape = plaintext]
    proposed [label = "Proposed"];
    review [label = "In Review"];
    fcp [label = "Final Comment Period"];
    approved [label = "Approved"];
    planning [label = "Planning"];
    implementing [label = "Implementing"];
    done [label = "Done"];
    rejected [label = "Rejected"];

    idea -> proposed [label = "github issue created"]
    proposed -> review [label = "pull request with rfc doc created"];
    review -> review [label = "doc revisions"];
    review -> fcp [label = "shepherd approved"];
    review -> rejected [label = "rejected"];
    fcp -> review [label = "revision requested"];
    fcp -> approved [label = "pull request approved and merged"];
    fcp -> rejected [label = "rfc rejected"];
    approved -> planning [label = "pull request with implementation plan created"];
    planning -> implementing [label = "rfc with implementation plan approved and merged"];
    implementing -> done [label = "implementation completed"];
}
-->

1. **Proposed** - A tracking issue has been created with a basic outline of the
   proposal.
2. **Review** - An RFC document has been written with a detailed design and a PR is
   under review. At this point the PR will be assigned a **shepherd** from the core
   team.
3. **Final Comment Period** - The shepherd has approved the RFC PR, and announces
   that the RFC enters a period for final comments before it will be approved (~1wk).
   At this stage, if major issues are raised, the RFC may return to **Review**.
4. **Approved** - The RFC PR is approved and merged to `master`, and the RFC is now
   ready to be implemented.
5. **Planning** - A PR is created with the **Implementation Plan** section of the RFC.
6. **Implementing** - Implemetation plan is approved and merged and the RFC is actively
   being implemented.
7. **Done** - Implementation is complete and merged across appropriate
   repositories.
8. **Rejected** - During the review period, the RFC may be rejected and then it will
   be marked as such.

---

This project's RFC process owes its inspiration to the [Yarn RFC process], [Rust
RFC process], [React RFC process], and [Ember RFC process]

[yarn rfc process]: https://github.com/yarnpkg/rfcs
[rust rfc process]: https://github.com/rust-lang/rfcs
[react rfc process]: https://github.com/reactjs/rfcs
[ember rfc process]: https://github.com/emberjs/rfcs
