# Cost Overview

Frontend Service Discovery on AWS is a solution you deploy in your own AWS account using
[AWS CloudFormation]. There is no charge for the solution: you pay only for the
AWS services used to run the solution. This page outlines the services used by
the solution, and examples of the charges you should expect for typical usage of
the solution.

> **Disclaimer**
>
> You are responsible for the cost of the AWS services used while running this
> deployment. There is no additional cost for using the solution. For full
> details, see the following pricing pages for each AWS service you will be
> using. Prices are subject to change.

## Index

- [Overview](#overview)
  - [AWS Lambda](#aws-lambda)
  - [AWS Step Functions](#aws-step-functions)
  - [Amazon API Gateway](#amazon-api-gateway)
  - [Amazon Cognito](#amazon-cognito)
  - [Amazon DynamoDB](#amazon-dynamodb)

## Overview

Frontend Service Discovery on AWS uses a serverless computing architecture.
This model minimises costs when you're not actively using the solution, and
allows the solution to scale while only paying for what you use.

### AWS Lambda

AWS Lambda Functions are used throughout the solution. You pay for the requests
to, and execution time of, these functions. Functions are invoked by the API.

[AWS Lambda Pricing]

### AWS Step Functions

AWS Step Functions Standard Workflows are used when a deployment is initiated. You pay
for the amount of state transitions in the Step Function Workflow.

[AWS Step Functions Pricing]

### Amazon API Gateway

Amazon API Gateway is used to provide the solution APIs. You
pay for requests made when using the web interface or API, and any data
transferred out.

[Amazon API Gateway Pricing]

### Amazon Cognito

Amazon Cognito provides authentication to secure access to the Admin API using an
administrative user created during deployment. You pay a monthly fee for active users in the Cognito User Pool.

[Amazon Cognito Pricing]

### Amazon DynamoDB

Amazon DynamoDB stores internal state data for the solution. All tables created
by the solution use the on-demand capacity mode of pricing. You pay for storage
used by these tables, and DynamoDB capacity used when interacting with the solution API.

- [Amazon DynamoDB Pricing]

[aws cloudformation]: https://aws.amazon.com/cloudformation/
[aws lambda pricing]: https://aws.amazon.com/lambda/pricing/
[aws step functions pricing]: https://aws.amazon.com/step-functions/pricing/
[amazon api gateway pricing]: https://aws.amazon.com/api-gateway/pricing/
[amazon cognito pricing]: https://aws.amazon.com/cognito/pricing/
[amazon dynamodb pricing]: https://aws.amazon.com/dynamodb/pricing/
