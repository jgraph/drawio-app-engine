//Logs uncaught errors
window.onerror = function(message, url, linenumber, colno, err)
{
    message = 'Monday.com Editor: ' + ((message != null) ? message : '');
	MC.logError(message, url, linenumber, colno, err);
};

const monday = window.mondaySdk();

monday.get('context').then(context => 
{
    MC.init(context, monday);
    const DEBUG = true;
    const hostUrl = DEBUG? 'https://test.draw.io' : 'https://embed.diagrams.net'; // TODO Does it need to be changed
    let lang = context.data.user.currentLanguage;
    let isNew = MC.getUrlParam('new') == '1';
	let diagramId = MC.getUrlParam('diagramId', true);
    let isSketch = MC.getUrlParam('sketch') == '1';

    var ui = isSketch? 'sketch' : 'kennedy';
	var plugins = 'monday';

    let editor = document.createElement('iframe');
	editor.setAttribute('width', '100%');
	editor.setAttribute('height', '100%');
	editor.style.width = '100%';
	editor.style.height = '100%';
	editor.setAttribute('id', 'editorFrame');
	editor.setAttribute('frameborder', '0');
	editor.setAttribute('src', hostUrl + (DEBUG? '/?dev=1&test=1&' : '/?') +
			'ui=' + ui + '&p=' + plugins + '&embed=1&embedRT=1' +
			'&keepmodified=1&spin=1&libraries=1&browser=0&proto=json' +
		    ((lang != null) ? '&lang=' + lang : '') /*+ '&configure=1'*/); // TODO Add configuration later if possible

	var initReceived = false;
	var xmlReceived = null;
    var diagramName = null;
    var diagramDesc = null;

    function startEditor()
	{
		if (initReceived && (isNew || xmlReceived != null))
		{
            document.body.style.backgroundImage = 'none';

            if (xmlReceived != null)
            {
                editor.contentWindow.postMessage(JSON.stringify({action: 'load',
                    autosave: 0, xml: xmlReceived, title: diagramName,
                    desc: diagramDesc}), '*');
            }
            // New sketch diagrams open empty
            else if (isSketch)
            {
                const newBoardName = 'New Board' + '-' + Date.now();
                promptName(newBoardName);
            }		
            // Shows template dialog for new diagrams with no draft state
            else
            {
                // Show Template Dialog
                editor.contentWindow.postMessage(JSON.stringify({action: 'template', callback: true, withoutType: 1}), '*');
            }
            
            function promptName(name, errKey)
            {
                editor.contentWindow.postMessage(JSON.stringify({action: 'prompt',
                    titleKey: 'filename', okKey: 'ok', defaultValue: name || '' }), '*');
                
                if (errKey != null)
                {
                    editor.contentWindow.postMessage(JSON.stringify({action: 'dialog',
                        titleKey: 'error', messageKey: errKey,
                        buttonKey: 'ok'}), '*');
                }
            };
            
            function checkName(name, fn, err)
            {
                if (name == null || name.length == 0)
                {
                    err(name, 'filenameShort');
                }
                else
                {
                    fn(name.trim());
                }
            };

            function messageListener(evt)
            {
                if (evt.origin == hostUrl)
                {
                    var drawMsg;
                    
                    try
                    {
                        drawMsg = JSON.parse(evt.data);
                    }
                    catch (e)
                    {
                        MC.logError('BAD Monday.com MSG: ' + evt.data, null, null, null, e, 'SEVER');
                        drawMsg = {}; //Ignore this message
                    }
        
                    if (drawMsg.event == 'template')
                    {
                        editor.contentWindow.postMessage(JSON.stringify({action: 'spinner',
                            show: true, messageKey: 'inserting'}), '*');

                        checkName(drawMsg.name, function(name)
                        {
                            editor.contentWindow.postMessage(JSON.stringify({action: 'spinner',
                                show: false}), '*');
                            diagramName = name;
    
                            editor.contentWindow.postMessage(JSON.stringify({action: 'load',
                                autosave: 0, xml: drawMsg.xml, title: diagramName,
                                desc: {id: MC.generateDiagramId(), name: diagramName
                                    , size: drawMsg.xml.length, etag: null}}), '*');
                        },
                        function(name, errKey)
                        {
                            editor.contentWindow.postMessage(JSON.stringify({action: 'spinner',
                                show: false}), '*');
                            editor.contentWindow.postMessage(JSON.stringify({action: 'dialog',
                                titleKey: 'error', messageKey: errKey,
                                buttonKey: 'ok'}), '*');
                        });
                    }
                    else if (drawMsg.event == 'exit' || drawMsg.event == 'prompt-cancel') 
                    {
                        monday.execute('closeAppFeatureModal').then((res) => {});
                    }
                    else if (drawMsg.event == 'rename')
                    {
                        localStorage.setItem('mondayNewDiagramName', drawMsg.name);
                    }
                    else if (drawMsg.event == 'prompt')
                    {
                        // Used for new sketch diagrams only
                        checkName(drawMsg.value, function(newBoardName)
                        {
                            editor.contentWindow.postMessage(JSON.stringify({action: 'load',
                                    autosave: 0, xml: '', title: newBoardName,
                                    desc: {id: MC.generateDiagramId(), name: newBoardName
                                        , size: 0, etag: null}}), '*');
                        }, promptName);
                    }
                    else if (drawMsg.event == 'remoteInvoke')
                    {
                        MC.handleRemoteInvoke(drawMsg);
                    }
                    else if (drawMsg.event == 'remoteInvokeResponse')
                    {
                        MC.handleRemoteInvokeResponse(drawMsg);
                    }
                }
            };

            window.addEventListener('message', messageListener);
            editor.contentWindow.postMessage(JSON.stringify({action: 'remoteInvokeReady'}), '*');
            MC.remoteWin = editor.contentWindow;
        }
	};
    
    function initHandler(evt)
    {
        if (evt.origin == hostUrl)
        {
            var msg;
            
            try
            {
                msg = JSON.parse(evt.data);
            }
            catch (e)
            {
                MC.logError('BAD MONDAY.com MSG: ' + evt.data, null, null, null, e, 'SEVER');
                msg = {}; //Ignore this message
            }
            
            if (msg.event == 'configure')
            {/*
                // Configure must be sent even if JSON invalid
                configObj = configObj || {};
                editor.contentWindow.postMessage(JSON.stringify({action: 'configure',
                    config: configObj}), '*');*/
            }
            else if (msg.event == 'init')
            {
                window.removeEventListener('message', initHandler);
                initReceived = true;
                startEditor();
            }
        }
    };

    window.addEventListener('message', initHandler);

    if (diagramId)
    {
        MC.loadDiagram(diagramId, (xml, desc) =>
        {
            xmlReceived = xml;
            diagramDesc = desc;
            diagramName = desc.name;
            startEditor();
        },
        (err) =>
        {
            MC.showError(err, 'Error loading diagram');
            monday.execute('closeAppFeatureModal').then((res) => {});
        });
    }

    document.body.appendChild(editor);

    // TODO How to save a global config?
	/*MC.getConfig(function (config, fromCache) 
    {
		configObj = config;
		startEditor();
	}, startEditor, true);  //if there is an error loading the configuration, just load the editor normally. E.g., 404 when the space doesn't exist*/
});