/**
 * Copyright (c) 2006-2022, JGraph Ltd
 */
package com.mxgraph.online;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;

import java.util.HashMap;
import java.io.IOException;

import org.apache.commons.lang3.exception.ExceptionUtils;

public class GitHubAuthLambda extends GoogleAuth implements AuthLambdaComm, RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse>
{
	@Override
	public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
		APIGatewayV2HTTPResponse response = new APIGatewayV2HTTPResponse();
		response.setIsBase64Encoded(false);
		
		try
		{
			super.doGetAbst(event, response);
			return response;
		}
		catch(Throwable e)
		{
			response.setStatusCode(500);
			response.setBody("Unexpected Error");
			//response.setBody("{ \"Error\": \"" + e.getMessage() + ":::" + ExceptionUtils.getStackTrace(e) + "\"}");
			return response;
		}
	}
}
