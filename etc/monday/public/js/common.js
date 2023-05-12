// Monday Common Functions
var MC = {};

MC.VERSION = '1.0.0';

MC.getUrlParam = function(param, escape, url)
{
    try
    {
    	var url = url || window.location.search;

		var result = (new RegExp(param + '=([^&]*)')).exec(url);
		
		if (result != null && result.length > 0)
		{
			// decode URI with plus sign fix.
			return (escape) ? decodeURIComponent(result[1].replace(/\+/g, '%20')) : result[1];
		}
		
		return null;
    }
    catch (e)
    {
        return undefined;
    }
};

MC.DIAGRAMS_LIST = 'diagrams_list';

/**
 * Alphabet for global unique IDs.
 */
MC.GUID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';

/**
 * Default length for global unique IDs.
 */
MC.GUID_LENGTH = 15;

/**
 * Default length for global unique IDs.
 */
MC.guid = function(length)
{
    var len = (length != null) ? length : MC.GUID_LENGTH;
    var rtn = [];
    
    for (var i = 0; i < len; i++)
    {
        rtn.push(MC.GUID_ALPHABET.charAt(Math.floor(Math.random() * MC.GUID_ALPHABET.length)));
    }

    return rtn.join('');
};

MC.generateDiagramId = function()
{
    return (MC.context.data.instanceId) + ':' + MC.guid();
};

MC.init = function(context, monday)
{
    MC.context = context;
    MC.monday = monday;
};

MC.showError = function(err, defMsg)
{
    console.error(err);
    let message = defMsg;
    
    try
    {
        if (typeof err == 'string')
        {
            message = err;
        }
        else if (err)
        {
            message = (err.data && err.data.error? err.data.error : 
                        (err.message || err.error_message || err.error_code || err.errors)) || message;
        }
    }
    catch (e) {}

    MC.monday.execute('notice', { 
        message: message,
        type: 'error',
        timeout: 30000,
    });
};

MC.apiWrapper = function(fn)
{
    return function()
    {
        var error = arguments[arguments.length - 1];

        if (MC.monday == null || MC.context == null) return error("Not initialized");
        
        fn.apply(this, arguments);
    };
};

MC.apiRequest = function(query, success, error)
{
    MC.monday.api(query).then(res => {
        if (res.hasOwnProperty('error_message') || res.hasOwnProperty('error_code') || res.hasOwnProperty('errors'))
        {
            error(res);
        }
        else 
        {
            success(res);
        }
    }).catch(error);
};

MC.addToStorage = function(key, value, version, success, error)
{
    value = JSON.stringify(value);

    // Key length limit: 256, Storage limit per key: 6MB
    if (key.length > 256 || value.length > 6 * 1024 * 1024)
    {
        error("Key or value too long");
        return;
    }

    MC.monday.storage.instance.setItem(key, value, 
            version != null? { previous_version: version } : undefined).then(res => 
    {
        if (res.data)
        {
            if (res.data.success)
            {
                success(res.data.version);
            }
            else
            {
                error(res.data.error && res.data.error.startsWith('Version mismatch:')? 409 : res.data.error);
            }
        }
        else
        {
            error(res);
        }
    });
};

MC.getFromStorage = function(key, success, error)
{   
    MC.monday.storage.instance.getItem(key).then(res => 
    {
        if (res.data && res.data.success)
        {
            try
            {
                success(JSON.parse(res.data.value), res.data.version);
            }
            catch (e) 
            {
                error(e);
            }
        }
        else
        {
            error(res);
        }
    });
};

MC.loadDiagram = MC.apiWrapper(function (diagramId, success, error)
{
    MC.getFromStorage(diagramId, function(data, version)
    {
        data.desc.etag = version;
        success(data.xml, data.desc);
    }, error);
});

MC.getDiagramList = MC.apiWrapper(function (success, error)
{
    MC.getFromStorage(MC.DIAGRAMS_LIST, function(list)
    {
        success(list || []);
    }, error); 
});

MC.updateDiagramList = MC.apiWrapper(function (diagramInfo, forceUpdate, success, error)
{
    MC.getDiagramList((list, version) => 
    {
        var diagram = list.filter(diagram => diagram.id == diagramInfo.id);

        if (diagram.length == 0 || forceUpdate)
        {
            if (diagram.length > 0 && forceUpdate)
            {
                diagram[0].name = diagramInfo.name;
            }
            else
            {
                list.push(diagramInfo);
            }

            MC.addToStorage(MC.DIAGRAMS_LIST, list, version, success, function(error)
            {
                if (error == 409)
                {
                    MC.updateDiagramList(diagramInfo, forceUpdate, success, error);
                }
                else
                {
                    error(res);
                }
            });
        }
        else
        {
            success();
        }
    }, error);
});

MC.deleteDiagram = MC.apiWrapper(function (diagramId, success, error)
{
    MC.getDiagramList((list, version) => 
    {
        var diagram = list.filter(diagram => diagram.id == diagramId);

        if (diagram.length > 0)
        {
            // TODO Mark as deleted or remove?
            //diagram[0].isDeleted = true;
            list.splice(list.indexOf(diagram[0]), 1);

            MC.addToStorage(MC.DIAGRAMS_LIST, list, version, success, function(error)
            {
                if (error == 409)
                {
                    MC.deleteDiagram(diagramId, success, error);
                }
                else
                {
                    error(res);
                }
            });
        }
        else
        {
            success();
        }
    }, error);
});

MC.saveDiagram = MC.apiWrapper(function (diagramId, xml, desc, rename, success, error)
{
    var isNew = desc.etag == null;
    desc.lastModified = Date.now();

    MC.addToStorage(diagramId, {xml: xml, desc: desc}, 
            // Send previous version with new files helps detecting key conflicts (rare)
            isNew? 'new' : desc.etag, newVer => 
    {
        desc.etag = newVer;
        desc.size = xml.length;

        if (isNew || rename)
        {
            MC.updateDiagramList({
                id: diagramId,
                name: desc.name,
            }, rename, () => { success(desc); }, error);
        }
        else
        {
            success(desc);
        }
    }, error);
});

MC.getCurrentUser = MC.apiWrapper(function (success, error)
{
    MC.apiRequest(`query { users (ids: ${MC.context.data.user.id}) { id, email, name, photo_thumb, current_language } }`, res => {
        success(res.data.users[0]);
    }, error);
});

MC.logError = function(message, url, linenumber, colno, err, severity, noStack)
{
	if (message != null)
	{
		err = (err != null) ? err : new Error(message);
		var stack = (err.stack != null) ? err.stack : new Error().stack;
		severity = (severity != null) ? severity : ((message.indexOf('NetworkError') < 0 &&
			message.indexOf('SecurityError') < 0 && message.indexOf('NS_ERROR_FAILURE') < 0 &&
			message.indexOf('out of memory') < 0) ? 'SEVERE' : 'CONFIG');
		
		try
		{
			if (message != MC.lastErrorMessage && message.indexOf('extension:') < 0 &&
				stack.indexOf('extension:') < 0 && stack.indexOf('<anonymous>:') < 0)
			{
				MC.lastErrorMessage = message;
				
				var img = new Image();
				img.src = 'https://log.draw.io/log?severity=' + severity + '&MC-v=' + encodeURIComponent(MC.VERSION) +
					((typeof window.EditorUi !== 'undefined') ? '&v=' + encodeURIComponent(EditorUi.VERSION) : '') +
					'&msg=clientError:' + encodeURIComponent(message) + ':url:' + encodeURIComponent(window.location.href) +
					':lnum:' + encodeURIComponent(linenumber) + ((colno != null) ? ':colno:' + encodeURIComponent(colno) : '') +
					((!noStack && stack != null) ? '&stack=' + encodeURIComponent(stack) : '');
			}
		}
		catch (err)
		{
			// do nothing
		}
	}
};

//White-listed functions and some info about it
MC.remoteInvokableFns = {
    loadDiagram: {isAsync: true},
    saveDiagram: {isAsync: true},
    getCurrentUser: {isAsync: true}
};

MC.remoteInvokeCallbacks = [];

MC.handleRemoteInvokeResponse = function(msg)
{
    var msgMarkers = msg.msgMarkers;
    var callback = MC.remoteInvokeCallbacks[msgMarkers.callbackId];
    
    if (msg.error)
    {
        if (callback.error) callback.error(msg.error.errResp);
    }
    else if (callback.callback)
    {
        callback.callback.apply(this, msg.resp);
    }
    
    MC.remoteInvokeCallbacks[msgMarkers.callbackId] = null; //set it to null only to keep the index
};

//Here, the editor is ready before sending init even which starts everything, so no need for waiting for ready message. Init is enough
MC.remoteInvoke = function(remoteFn, remoteFnArgs, msgMarkers, callback, error)
{
    msgMarkers = msgMarkers || {};
    msgMarkers.callbackId = MC.remoteInvokeCallbacks.length;
    MC.remoteInvokeCallbacks.push({callback: callback, error: error});
    MC.remoteWin.postMessage(JSON.stringify({action: 'remoteInvoke', funtionName: remoteFn, functionArgs: remoteFnArgs, msgMarkers: msgMarkers}), '*');
};

MC.handleRemoteInvoke = function(msg)
{
    function sendResponse(resp, error)
    {
        var respMsg = {action: 'remoteInvokeResponse', msgMarkers: msg.msgMarkers};
        
        if (error != null)
        {
            respMsg.error = {errResp: error};
        }
        else if (resp != null) 
        {
            respMsg.resp = resp;
        }
        
        MC.remoteWin.postMessage(JSON.stringify(respMsg), '*');
    }
    
    try
    {
        //Remote invoke are allowed to call functions in DrawIO
        var funtionName = msg.funtionName;
        var functionInfo = MC.remoteInvokableFns[funtionName];
        
        if (functionInfo != null && typeof MC[funtionName] === 'function')
        {
            var functionArgs = msg.functionArgs;
            
            //Confirm functionArgs are not null and is array, otherwise, discard it
            if (!Array.isArray(functionArgs))
            {
                functionArgs = [];
            }
            
            //for functions with callbacks (async) we assume last two arguments are success, error
            if (functionInfo.isAsync)
            {
                //success
                functionArgs.push(function() 
                {
                    sendResponse(Array.prototype.slice.apply(arguments));
                });
                
                //error
                functionArgs.push(function(err) 
                {
                    sendResponse(null, err || 'Unknown Error');
                });
                
                MC[funtionName].apply(this, functionArgs);
            }
            else
            {
                var resp = MC[funtionName].apply(this, functionArgs);
                
                sendResponse([resp]);
            }
        }
        else
        {
            sendResponse(null, 'Invalid Call. Function "' + funtionName + '" Not Found.');
        }
    }
    catch(e)
    {
        sendResponse(null, 'Invalid Call. Error Occured: ' + e.message);
        console.log(e);
    }
};