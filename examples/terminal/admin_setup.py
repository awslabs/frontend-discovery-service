import os
import argparse
import boto3
import requests
import logging
import json
from utils.admin_user import initiate_auth, setup_admin_user, delete_admin_user

cloudformation = boto3.client('cloudformation')
cognito = boto3.client('cognito-idp')

def main(args):
    # delete any existing .env file
    if os.path.exists('.env'):
        os.remove('.env')

    logging.info(f'Starting prepare.py for stack: {args.stack}')

    # get stack values
    stack = cloudformation.describe_stacks(StackName=args.stack)['Stacks'][0]
    userPoolId = [x['OutputValue'] for x in stack['Outputs']
                  if x['OutputKey'] == 'CognitoUserPoolID'][0]
    cognitoWebClientID = [x['OutputValue']
                          for x in stack['Outputs'] if x['OutputKey'] == 'CognitoWebClientID'][0]
    consumerApi = [x['OutputValue']
                   for x in stack['Outputs'] if x['OutputKey'] == 'ConsumerApi'][0]
    adminApi = [x['OutputValue']
                for x in stack['Outputs'] if x['OutputKey'] == 'AdminApi'][0]
    
    logging.info(f'Found admin api: {adminApi}')
    logging.info(f'Found consumer api: {consumerApi}')
    
    setup_admin_user(cognito, userPoolId, cognitoWebClientID)
    idToken = initiate_auth(cognito, userPoolId, cognitoWebClientID)
    headers = {'Authorization': idToken}

    # post project
    project = requests.post(
        f'{adminApi}/projects', json={'name': 'my-project'}, headers=headers).json()
    projectId = project['id']

    logging.info(f'POST: {adminApi}/projects')
    print(json.dumps(project, indent=4))

    # post mfe
    mfe = requests.post(f'{adminApi}/projects/{projectId}/microFrontends',
                        json={'name': 'catalog'}, headers=headers).json()
    mfeId = mfe['microFrontendId']

    logging.info(f'POST: {adminApi}/projects/{projectId}/microFrontends')
    print(json.dumps(mfe, indent=4))

    # post v1
    v1 = requests.post(f'{adminApi}/projects/{projectId}/microFrontends/{mfeId}/versions', json={'version': {
        'url': "https://static.example.com/catalog-1.0.0.js",
        'fallbackUrl': "https://alt-cdn.com/catalog-1.0.0.js",
        'metadata': {
            'integrity': "e0d123e5f316bef78bfdf5a008837577",
            'version': "1.0.0",
        },
    }}, headers=headers).json()

    logging.info(f'POST: {adminApi}/projects/{projectId}/microFrontends/{mfeId}/versions')
    print(json.dumps(v1, indent=4))

    # post v2
    v2 = requests.post(f'{adminApi}/projects/{projectId}/microFrontends/{mfeId}/versions', json={'version': {
        'url': "https://static.example.com/catalog-2.0.0.js",
        'fallbackUrl': "https://alt-cdn.com/catalog-2.0.0.js",
        'metadata': {
            'integrity': "e0d123e5f316bef78bfdf5a008837600",
            'version': "2.0.0",
        },
    }}, headers=headers).json()

    logging.info(f'POST: {adminApi}/projects/{projectId}/microFrontends/{mfeId}/versions')
    print(json.dumps(v2, indent=4))

    delete_admin_user(cognito, userPoolId)

    # write .env file
    with open(".env", "w") as f:
        f.write(f'STACK_NAME={stack["StackName"]}\n')
        f.write(f'CONSUMER_API={consumerApi}\n')
        f.write(f'PROJECT_ID={projectId}\n')
        f.write(f'MFE_ID={mfeId}\n')

def parse_args():
    parser = argparse.ArgumentParser(
        description="prepares a project for demo purposes")
    parser.add_argument("stack", type=str, help="the stack name for the soluton",
                        nargs='?', default='frontend-discovery-service')
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    logging.getLogger().setLevel(logging.INFO)
    logging.basicConfig(format="%(asctime)s %(message)s",
                        datefmt="%d/%m/%Y %I:%M:%S %p")
    main(args)
