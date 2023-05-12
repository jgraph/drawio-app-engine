/**
 * Plugin for embed mode in Monday.com
 */
Draw.loadPlugin(function(ui)
{
    var loadDescriptor = null;
    var monUser = null;
    
    mxEvent.addListener(window, 'message', mxUtils.bind(this, function(evt)
    {
        var data = evt.data;

        try
        {
            data = JSON.parse(data);
            
            if (data.action == 'load')
            {
                if (data.desc != null)
                {
                    loadDescriptor = data.desc;
                }
            }
        }
        catch (e)
        {
            // Ignore
        }
    }));

    // Set default filename here is still unique as this file is used by one editor only at a time
    ui.defaultFilename = mxResources.get('untitledDiagram') + '-' + Date.now();

    ui.getCurrentUser = function()
	{
		if (monUser == null)
		{
			ui.remoteInvoke('getCurrentUser', null, null, function(user)
			{
				monUser = user == null? new DrawioUser(Date.now(), null, 'Anonymous')
                                : new DrawioUser(user.id, user.email, user.name, user.photo_thumb, user.current_language);
			}, function()
			{
				//ignore such that next call we retry
			});
			
			//Return a dummy user until we have the actual user in order for UI to be populated
			return new DrawioUser(Date.now(), null, 'Anonymous');
		}
		
		return monUser;
	};

    var renameAction = ui.actions.get("rename"); 

	renameAction.visible = true;
	
	renameAction.funct = function()
	{
        const curFile = ui.getCurrentFile();
		const dlg = new FilenameDialog(ui, curFile.getTitle(),
				mxResources.get('rename'), function(newName)
		{
			if (newName != null && newName.length > 0)
			{
                var parent = window.opener || window.parent;
				parent.postMessage(JSON.stringify({event: 'rename', name: newName}), '*'); 

				//Update and sync new name
				curFile.rename(newName);
			}
		}, mxResources.get('rename'), function(name)
		{
			var err = '';

			if (name == null || name.length == 0)
			{
				err = 'Filename too short';
			}
			else
			{
				return true;
			}
			
			ui.showError(mxResources.get('error'), err, mxResources.get('ok'));
			return false;
		});
		ui.showDialog(dlg.container, 300, 80, true, true);
		dlg.init();
	}

    //======================== Revisions ========================
	
	ui.isRevisionHistoryEnabled = function()
	{
        return false; // TODO Should we implement versioning from scratch?
	};
	
	ui.isRevisionHistorySupported = function()
	{
		return ui.isRevisionHistoryEnabled();
	};

    //============= Embed File with real-time collab support =================
    // Use optimistic sync since we cannot save file properties/metadata so far
    // TODO Move to full sync as we can save file properties/metadata in Monday.com?
    /**
     * Shorter autosave delay for optimistic sync.
     */
    EmbedFile.prototype.autosaveDelay = 500;

    /**
     * Delay for last save in ms.
     */
    EmbedFile.prototype.saveDelay = 0;
    
    /**
     * 
     */
    EmbedFile.prototype.isConflict = function(err)
    {
        return err == 409;
    };

    /**
     * Returns the current user.
     */
    EmbedFile.prototype.getCurrentUser = function()
    {
        return ui.getCurrentUser();
    };

    EmbedFile.prototype.isRealtimeSupported = function()
    {
        return true;
    };
    
    EmbedFile.prototype.rename = function(title, success, error)
	{
		this.desc.name = title;
		this.save(null, mxUtils.bind(this, function(desc)
        {
            this.desc = desc;
			this.descriptorChanged();
			
			if (this.sync != null)
			{
				this.sync.descriptorChanged(this.desc.etag);
			}
			
			if (success != null)
			{
				success(desc);
			}
        }), error, null, null, true);
	};

    /**
     * 
     */
    EmbedFile.prototype.save = function(revision, success, error, unloading, overwrite, rename)
    {
        this.saveStarted = true;
        
        DrawioFile.prototype.save.apply(this, [revision, mxUtils.bind(this, function()
        {
            this.saveFile(null, revision, success, error, unloading, overwrite, rename);
            this.saveStarted = false;
        }), error, unloading, overwrite]);
    };

    /**
     * 
     */
    EmbedFile.prototype.setModified = function(value)
    {
        DrawioFile.prototype.setModified.apply(this, arguments);
        
        //Set editor modified also to prevent accidental closure or exiting without saving  
        ui.editor.modified = value;
    };
    
    /**
     * 
     */
    EmbedFile.prototype.saveFile = function(title, revision, success, error, unloading, overwrite, rename)
    {
        EditorUi.debug('EmbedFile.saveFile', [this], 'saving', this.savingFile);

        try
        {
            if (!this.isEditable())
            {
                if (success != null)
                {
                    success(this.desc);
                }
            }
            else if (!this.savingFile)
            {
                // Sets shadow modified state during save
                this.savingFileTime = new Date();
                this.setShadowModified(false);
                this.savingFile = true;


                var doSave = mxUtils.bind(this, function()
                {
                    try
                    {
                        var lastDesc = this.desc;
                        var savedData = this.getData();
                        
                        if (this.sync != null)
                        {
                            this.sync.fileSaving();
                        }

                        ui.remoteInvoke('saveDiagram', [this.desc.id, savedData, this.desc, rename], null, mxUtils.bind(this, function(resp)
                        {
                            try
                            {
                                // Checks for changes during save
                                this.setModified(this.getShadowModified());
                                this.savingFile = false;
                                this.desc = Object.assign({}, this.desc); // Clone the object
                                Object.assign(this.desc, resp); // Assign the new values
            
                                this.fileSaved(savedData, lastDesc, mxUtils.bind(this, function()
                                {
                                    this.contentChanged();
                                    
                                    if (success != null)
                                    {
                                        success(this.desc);
                                    }
                                }), error);
                            }
                            catch (e)
                            {
                                this.savingFile = false;
                                
                                if (error != null)
                                {
                                    error(e);
                                }
                                else
                                {
                                    throw e;
                                }
                            }
                        }),
                        mxUtils.bind(this, function(err)
                        {
                            try
                            {
                                this.savingFile = false;
                            
                                if (this.isConflict(err))
                                {
                                    this.inConflictState = true;
                                    
                                    if (this.sync != null)
                                    {
                                        this.savingFile = true;
                                        
                                        this.sync.fileConflict(null, mxUtils.bind(this, function()
                                        {
                                            // Adds random cool-off
                                            var delay = 100 + Math.random() * 500;
                                            window.setTimeout(mxUtils.bind(this, function()
                                            {
                                                this.updateFileData();
                                                doSave();
                                            }), delay);

                                            EditorUi.debug('EmbedFile.saveFile.conflict',
                                                [this], 'err', err, 'delay', delay);
                                        }), mxUtils.bind(this, function()
                                        {
                                            this.savingFile = false;
                                            
                                            if (error != null)
                                            {
                                                error();
                                            }
                                        }));
                                    }
                                    else if (error != null)
                                    {
                                        error();
                                    }
                                }
                                else if (error != null)
                                {
                                    error(err);
                                }
                            }
                            catch (e)
                            {
                                this.savingFile = false;
                                
                                if (error != null)
                                {
                                    error(e);
                                }
                                else
                                {
                                    throw e;
                                }
                            }
                        }));
                    }
                    catch (e)
                    {
                        this.savingFile = false;
                        
                        if (error != null)
                        {
                            error(e);
                        }
                        else
                        {
                            throw e;
                        }
                    }
                });
                
                doSave();
            }
        }
        catch (e)
        {
            if (error != null)
            {
                error(e);
            }
            else
            {
                throw e;
            }
        }
    };

    /**
     * 
     */
    EmbedFile.prototype.getTitle = function()
    {
        return this.desc.name;
    };

    /**
     * 
     */
    EmbedFile.prototype.getHash = function()
    {
        return 'E' + this.getId();
    };

    /**
     * Overridden to enable the autosave option in the document properties dialog.
     */
    EmbedFile.prototype.isAutosaveOptional = function()
    {
        return false;
    };

    EmbedFile.prototype.isRenamable = function()
	{
		return this.isEditable();
	};

    /**
     * 
     */
    EmbedFile.prototype.getId = function()
    {
        return this.desc.id;
    };

    /**
     * 
     */
    EmbedFile.prototype.isSyncSupported = function()
	{
		return this.desc != null && this.desc.id != null;
	};

    EmbedFile.prototype.isOptimisticSync = function()
    {
        return true;
    };

    OneDriveFile.prototype.getSize = function()
    {
        return this.desc.size;
    };

    /**
     * 
     */
    EmbedFile.prototype.getLatestVersion = function(success, error)
    {
        ui.remoteInvoke('loadDiagram', [this.desc.id],
                    null, mxUtils.bind(this, function(xml, desc)
        {
            success(new EmbedFile(ui, xml, desc));
        }), error);
    };

    /**
     * Gets the channel ID from the given descriptor.
     */
    EmbedFile.prototype.getChannelId = function()
    {
        return 'C-' + DrawioFile.prototype.getChannelId.apply(this, arguments);
    };

    OneDriveFile.prototype.getHash = function()
    {
        return 'C' + encodeURIComponent(this.getId());
    };

    /**
     * Using MD5 of create timestamp and user ID as crypto key.
     */
    EmbedFile.prototype.getChannelKey = function()
    {
        if (typeof CryptoJS !== 'undefined')
        {
            return CryptoJS.MD5(this.desc.id).toString();
        }
        
        return null;
    };

    /**
     * 
     */
    EmbedFile.prototype.getLastModifiedDate = function()
    {
        return new Date(this.desc.lastModified);
    };

    /**
     * 
     */
    EmbedFile.prototype.getDescriptor = function()
    {
        return this.desc;
    };

    /**
     * Updates the descriptor of this file with the one from the given file.
     */
    EmbedFile.prototype.setDescriptor = function(desc)
    {
        this.desc = desc;
    };

    /**
     * 
     */
    EmbedFile.prototype.getDescriptorEtag = function(desc)
    {
        return desc.etag;
    };

    /**
     *
     */
    EmbedFile.prototype.setDescriptorEtag = function(desc, etag)
    {
        desc.etag = etag;
    };

    /**
     * 
     */
    EmbedFile.prototype.loadDescriptor = function(success, error)
    {
        // We can't get the descriptor separate from the file xml
        ui.remoteInvoke('loadDiagram', [this.desc.id], null, function(xml, desc)
        {
            success(desc);
        }, error);
    };
    
    var allowAutoSave = true;
    
    EmbedFile.prototype.isAutosaveNow = function(success, error)
    {
        return allowAutoSave;
    };
    
    //Ensure saving is via the file
    ui.actions.get('save').funct = function(exit)
    {
        if (ui.editor.graph.isEditing())
        {
            ui.editor.graph.stopEditing();
        }

        var curFile = ui.getCurrentFile();
        
        if (exit)
        {
            allowAutoSave = false;
        }

        function doActions()
        {
            if (exit)
            {
                ui.actions.get('exit').funct();
            }
        };
        
        function doSave()
        {
            if (curFile.saveStarted || curFile.savingFile)
            {
                setTimeout(doSave, 100);
                return;
            }
            
            if (curFile.isModified())
            {
                ui.saveFile(null, doActions);
            }
            else
            {
                doActions();
            }
        };
        
        doSave();
    };

    function descriptorChangedListener()
	{
		var curFile = ui.getCurrentFile();
		var fileTitle = curFile.getTitle();
		
		//Update file name in the UI
		var tmp = document.createElement('span');
		mxUtils.write(tmp, mxUtils.htmlEntities(fileTitle));
		
		if (ui.embedFilenameSpan != null)
		{
			ui.embedFilenameSpan.parentNode.removeChild(ui.embedFilenameSpan);
		}

		ui.buttonContainer.appendChild(tmp);
		ui.embedFilenameSpan = tmp;
	};

    //Add file opening here (or it should be for all in EditorUi?)
    var origInstallMessageHandler =  ui.installMessageHandler;
    
    ui.installMessageHandler = function(callback)
    {
        origInstallMessageHandler.call(this, function()
        {
            callback.apply(this, arguments);
            
            var file = ui.getCurrentFile();
            file.setDescriptor(loadDescriptor || {});
            ui.fileLoaded(file, true);
            file.addListener('descriptorChanged', descriptorChangedListener);

            // New file with non-empty content
            if (file.desc.etag == null && file.desc.size > 0)
            {
                ui.saveFile();
            }
        });
    }
    
    ui.editor.setModified = function()
    {
        //Cancel set modified of the editor and use the file's one
    };

    //Prefetch current user 
	ui.getCurrentUser();
});
