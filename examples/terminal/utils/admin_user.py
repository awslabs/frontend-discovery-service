import random
import string

username = 'demo'
pwd = ''.join([random.choice(string.ascii_letters +
              string.digits + string.punctuation) for n in range(12)])


def setup_admin_user(cognito, userPoolId, cognitoWebClientID):
    delete_admin_user(cognito, userPoolId)
    # create an admin user
    cognito.admin_create_user(
        UserPoolId=userPoolId,
        Username=username,
        TemporaryPassword=pwd,
        MessageAction='SUPPRESS'
    )

    cognito.admin_set_user_password(
        UserPoolId=userPoolId,
        Username=username,
        Password=pwd,
        Permanent=True
    )

    cognito.update_user_pool_client(
        UserPoolId=userPoolId,
        ClientId=cognitoWebClientID,
        ExplicitAuthFlows=[
            "ALLOW_ADMIN_USER_PASSWORD_AUTH",
            "ALLOW_REFRESH_TOKEN_AUTH",
        ]
    )


def delete_admin_user(cognito, userPoolId):
    try:
        cognito.admin_delete_user(
            UserPoolId=userPoolId,
            Username=username
        )
    except:
        pass


def initiate_auth(cognito, userPoolId, cognitoWebClientID):
    auth = cognito.admin_initiate_auth(
        UserPoolId=userPoolId,
        ClientId=cognitoWebClientID,
        AuthFlow='ADMIN_USER_PASSWORD_AUTH',
        AuthParameters={
            'USERNAME': username,
            'PASSWORD': pwd,
        }
    )
    idToken = auth['AuthenticationResult']['IdToken']
    return idToken
