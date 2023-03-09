import os
import boto3
import requests
import logging
import json
from dotenv import load_dotenv
from utils.admin_user import initiate_auth, setup_admin_user, delete_admin_user

cloudformation = boto3.client('cloudformation')
cognito = boto3.client('cognito-idp')

stack_name = None
project = None
mfe = None


def main():

    logging.info(f'Starting deploy.py for stack: {stack_name}')

    # get stack values
    stack = cloudformation.describe_stacks(StackName=stack_name)['Stacks'][0]
    userPoolId = [x['OutputValue'] for x in stack['Outputs']
                  if x['OutputKey'] == 'CognitoUserPoolID'][0]
    cognitoWebClientID = [x['OutputValue']
                          for x in stack['Outputs'] if x['OutputKey'] == 'CognitoWebClientID'][0]
    adminApi = [x['OutputValue']
                for x in stack['Outputs'] if x['OutputKey'] == 'AdminApi'][0]
    
    logging.info(f'Found admin api: {adminApi}')

    setup_admin_user(cognito, userPoolId, cognitoWebClientID)
    idToken = initiate_auth(cognito, userPoolId, cognitoWebClientID)
    headers = {'Authorization': idToken}

    # post deployment
    deploymentBody = {'targetVersion': '2.0.0', 'deploymentStrategy': 'Linear10PercentEvery1Minute'}
    deployment = requests.post(
        f'{adminApi}/projects/{project}/microFrontends/{mfe}/deployment', json=deploymentBody, headers=headers)

    logging.info(f'POST: {adminApi}/projects/{project}/microFrontends/{mfe}/deployment')
    print('Request:')
    print(json.dumps(deploymentBody, indent=4))

    deploymentId = None
    if deployment.status_code == 201:
        print('Response:')
        print(json.dumps(deployment.json(), indent=4))
        logging.info('Deployment initiated')
        deploymentId = deployment.json()['deploymentId']
    else:
        logging.info(f'ERROR: Status: {deployment.status_code} - {deployment.text}')

    delete_admin_user(cognito, userPoolId)


if __name__ == "__main__":
    load_dotenv()
    stack_name = os.getenv('STACK_NAME')
    project = os.getenv('PROJECT_ID')
    mfe = os.getenv('MFE_ID')
    logging.getLogger().setLevel(logging.INFO)
    logging.basicConfig(format="%(asctime)s %(message)s",
                        datefmt="%d/%m/%Y %I:%M:%S %p")
    main()
