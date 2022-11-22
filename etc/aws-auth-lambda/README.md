## Lambda function deployment

If you want to create a new S3 bucket with random prefix, execute the following command
`./1-create-bucket.sh`.
It will create a new S3 bucket and store its name in the `bucket-name.txt` file. Otherwise, add your S3 bucket name to this file

Then, set the default region using the following commant before running the deploy script

`aws configure set default.region us-east-1`

Then, deploy using `./2-deploy.sh` which will build and upload the lambda function to `auth-lambda`

### AWS Deployment User

Create a user with a similar policy to:

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:*",
                "s3-object-lambda:*"
            ],
            "Resource": [
                "arn:aws:s3:::lambda-artifacts-4b77a1d66abd0402",
                "arn:aws:s3:::lambda-artifacts-4b77a1d66abd0402/*",
                "arn:aws:s3:::lambda-artifacts-5651894109987c7c",
                "arn:aws:s3:::lambda-artifacts-5651894109987c7c/*",
                "arn:aws:s3:::lambda-artifacts-e31ac4c3e7e43804",
                "arn:aws:s3:::lambda-artifacts-e31ac4c3e7e43804/*",
                "arn:aws:s3:::plantuml-serverless-prod-serverlessdeploymentbuck-1i7a7i34i6mze",
                "arn:aws:s3:::plantuml-serverless-prod-serverlessdeploymentbuck-1i7a7i34i6mze/*",
                "arn:aws:s3:::plantuml-serverless-prod-serverlessdeploymentbuck-1qi8dwe78hqhu",
                "arn:aws:s3:::plantuml-serverless-prod-serverlessdeploymentbuck-1qi8dwe78hqhu/*",
                "arn:aws:s3:::plantuml-serverless-prod-serverlessdeploymentbuck-87s1td72wt25",
                "arn:aws:s3:::plantuml-serverless-prod-serverlessdeploymentbuck-87s1td72wt25/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:*"
            ],
            "Resource": [
                "arn:aws:cloudformation:eu-central-1:450520124870:stack/gliffy-lambda/*",
                "arn:aws:cloudformation:us-east-1:450520124870:stack/gliffy-lambda/*",
                "arn:aws:cloudformation:ap-southeast-2:450520124870:stack/gliffy-lambda/*",
                "arn:aws:cloudformation:eu-central-1:450520124870:stack/plantuml-serverless-prod/*",
                "arn:aws:cloudformation:us-east-1:450520124870:stack/plantuml-serverless-prod/*",
                "arn:aws:cloudformation:ap-southeast-2:450520124870:stack/plantuml-serverless-prod/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:CreateChangeSet"
            ],
            "Resource": [
                "arn:aws:cloudformation:eu-central-1:aws:transform/Serverless-2016-10-31",
                "arn:aws:cloudformation:us-east-1:aws:transform/Serverless-2016-10-31",
                "arn:aws:cloudformation:ap-southeast-2:aws:transform/Serverless-2016-10-31"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudformation:ValidateTemplate"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "lambda:UpdateFunctionCode",
                "lambda:GetFunction",
                "lambda:AddPermission",
                "lambda:RemovePermission",
                "lambda:CreateFunctionUrlConfig",
                "lambda:DeleteFunctionUrlConfig",
                "lambda:UpdateFunctionUrlConfig",
                "lambda:GetFunctionUrlConfig",
                "lambda:ListTags",
                "lambda:ListVersionsByFunction",
                "lambda:PublishVersion"
            ],
            "Resource": [
                "arn:aws:lambda:eu-central-1:450520124870:function:gliffy-lambda-function-PZVGA64COK9H",
                "arn:aws:lambda:us-east-1:450520124870:function:gliffy-lambda-function-14F5SIJ6MLULC",
                "arn:aws:lambda:ap-southeast-2:450520124870:function:gliffy-lambda-function-aLZF2VGfuzLT",
                "arn:aws:lambda:eu-central-1:450520124870:function:plantuml-serverless-prod-*",
                "arn:aws:lambda:us-east-1:450520124870:function:plantuml-serverless-prod-*",
                "arn:aws:lambda:ap-southeast-2:450520124870:function:plantuml-serverless-prod-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "IAM:GetRole"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ecr:SetRepositoryPolicy",
                "ecr:GetRepositoryPolicy",
                "ecr:BatchGetImage",
                "ecr:BatchCheckLayerAvailability",
                "ecr:CompleteLayerUpload",
                "ecr:DescribeImages",
                "ecr:DescribeRepositories",
                "ecr:GetDownloadUrlForLayer",
                "ecr:InitiateLayerUpload",
                "ecr:ListImages",
                "ecr:PutImage",
                "ecr:UploadLayerPart"
            ],
            "Resource": [
                "arn:aws:ecr:eu-central-1:450520124870:repository/serverless-plantuml-serverless-prod",
                "arn:aws:ecr:us-east-1:450520124870:repository/serverless-plantuml-serverless-prod",
                "arn:aws:ecr:ap-southeast-2:450520124870:repository/serverless-plantuml-serverless-prod"
            ]
        },
        {
            "Effect": "Allow",
            "Action": "ecr:GetAuthorizationToken",
            "Resource": "*"
        }
    ]
}
```
### Add memcached (ElastiCache) and Secrets Manager

Currently the URLs are hardcoded (needs to be configured)

### Lambda access to Memcached (ElastiCache)

- Add VPC to Lambda and configure it with a subnet having a NAT gateway to have internet access (see https://nodogmablog.bryanhogan.net/2022/06/accessing-the-internet-from-vpc-connected-lambda-functions-using-a-nat-gateway/)
- In summary, one subnet with Internet Gateway to have internet access
- NAT Gateway in the public subnet (the one with the Internet Gateway above)
- Another with NAT Gateway to have internet access to VPC and internet via NAT Gateway
- Lambda function in the subnet with NAT Gateway