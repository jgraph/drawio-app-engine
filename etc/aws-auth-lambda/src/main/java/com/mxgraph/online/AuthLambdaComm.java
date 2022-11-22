/**
 * Copyright (c) 2006-2022, JGraph Ltd
 */
package com.mxgraph.online;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;
import java.util.HashMap;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;

public interface AuthLambdaComm extends AuthComm 
{
    default String getCookieValue(String name, Object request_p)
	{
		APIGatewayV2HTTPEvent request = (APIGatewayV2HTTPEvent) request_p;
		String val = null;
		
		String cookiesStr = request.getHeaders() != null? request.getHeaders().getOrDefault("Cookie", "") : "";
		String[] cookiesArr = cookiesStr.split(";");

		String[] cookieSplits;

		for(String cookie : cookiesArr) {
			cookieSplits = cookie.trim().split("=");

			if (name.equals(cookieSplits[0]))
			{
				val = cookieSplits[1];
				break;
			}
		}

		return val;
	}
	
	default void addCookie(String name, String val, int age, String cookiePath, Object response_p)
	{
		APIGatewayV2HTTPResponse response = (APIGatewayV2HTTPResponse) response_p;
		Map<String, String> headers = response.getHeaders();

		if (headers == null)
		{
			headers = new HashMap<String, String>();
		}

		headers.put("Set-Cookie", name + "=" + val + "; Max-Age=" + age + ";path=" + cookiePath + "; Secure; HttpOnly; SameSite=none");
		response.setHeaders(headers);
	}
	
	default void deleteCookie(String name, String cookiePath, Object response_p)
	{
		APIGatewayV2HTTPResponse response = (APIGatewayV2HTTPResponse) response_p;
		Map<String, String> headers = response.getHeaders();

		if (headers == null)
		{
			headers = new HashMap<String, String>();
		}
		
		headers.put("Set-Cookie", name + "= ;path=" + cookiePath + "; expires=Thu, 01 Jan 1970 00:00:00 UTC; Secure; HttpOnly; SameSite=none");
		response.setHeaders(headers);
	}
	
	default String getParameter(String name, Object request)
	{
		Map<String, String> params = ((APIGatewayV2HTTPEvent) request).getQueryStringParameters();
		return params != null ? params.get(name) : null;
	}

	default String getServerName(Object request)
	{
		return "lambda";
	}

	default String getRemoteAddr(Object request)
	{
		return "lambda";
	}

	default void setBody(String body, Object response) throws IOException
	{
		((APIGatewayV2HTTPResponse) response).setBody(body);
	}
	
	default void setStatus(int status, Object response)
	{
		((APIGatewayV2HTTPResponse) response).setStatusCode(status);
	}

	default void setHeader(String name, String value, Object response_p)
	{
		APIGatewayV2HTTPResponse response = (APIGatewayV2HTTPResponse) response_p;
		Map<String, String> headers = response.getHeaders();

		if (headers == null)
		{
			headers = new HashMap<String, String>();
		}

		headers.put(name, value);
		response.setHeaders(headers);
	}

	default void sendRedirect(String url, Object response_p) throws IOException
	{
		APIGatewayV2HTTPResponse response = (APIGatewayV2HTTPResponse) response_p;
		Map<String, String> headers = response.getHeaders();

		if (headers == null)
		{
			headers = new HashMap<String, String>();
		}
		
		headers.put("Location", url);
		response.setHeaders(headers);
		response.setStatusCode(302);
	}
}