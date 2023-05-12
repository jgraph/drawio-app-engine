import { useState, useEffect, useMemo } from "react";
import "monday-ui-react-core/dist/main.css";
import mondaySdk from "monday-sdk-js";

const monday = mondaySdk();

export default function GraphViewerCmp({diagramId, tabIndex, activeTab, updateTabs, updateTabName}) {
    const [edits, setEdits] = useState(0);
    const [diagram, setDiagram] = useState({desc: {}});

    // This is a hack to only load the xml when tab is activated (and not when the component is rendered). And only refresh when edited.
    const diagramXml = useMemo(() => 
    {
        return diagram;
    }, [diagram]);

    useEffect(() => {
        const container = document.getElementById(diagramId);
        
        if (!container)
        {
            return;
        }

        function deleteDiagram()
        {
            monday.execute('confirm', {
                message: 'Are you sure you want to delete "' + diagramXml.desc.name + '" diagram?', 
                confirmButton: "Yes", 
                cancelButton: "No", 
                excludeCancelButton: false
            }).then((res) => {
                if (res.data.confirm)
                {
                    window.MC.deleteDiagram(diagramId, () =>
                    {
                        updateTabs(0);
                    },
                    (err) =>
                    {
                        window.MC.showError(err, 'Error deleting diagram');
                    });        
                }
            });
        };
    
        function editDiagram()
        {
            const isSketch = window.MC.getUrlParam('sketch') === '1';
            monday.execute('openAppFeatureModal', { urlPath: window.location.pathname + "editor.html", urlParams: 'diagramId=' + encodeURIComponent(diagramId) + (isSketch? '&sketch=1' : ''),
                        height: "100vh", width: "100vw" }).then((res) => {
                setEdits(edits + 1); // Force reload
                
                // Rename the tab
                const newName = localStorage.getItem('mondayNewDiagramName');
                
                if (newName)
                {
                    updateTabName(activeTab, newName);
                    localStorage.removeItem('mondayNewDiagramName');
                }
            });
        };
    
        function renderDiagram(xml)
        {
            let config = {highlight: '#3572b0', nav: true, lightbox: false};
            let lbBtns = [];
            lbBtns.push(
                {icon: window.Editor.editImage, tooltip: window.mxResources.get('edit'), fn: editDiagram, isEditBtn: true},
                {icon: window.Editor.crossImage, tooltip: window.mxResources.get('delete'), fn: deleteDiagram}
            );
            window.EditorUi.prototype.lightboxToolbarActions = lbBtns;
            let viewer = new window.GraphViewer(null, null, config);
                                                
            viewer.lightboxChrome = false;
            viewer.xml = xml;
            viewer.layersEnabled = true;
            viewer.tagsEnabled = true;
            
            viewer.showLocalLightbox(container);
        };

         // TODO Cache viewer?
        if (diagramXml.xml && diagramXml.edits === edits)
        {
            renderDiagram(diagramXml.xml);
        }
        else
        {
            window.MC.loadDiagram(diagramId, (xml, desc) =>
            {
                setDiagram({xml, desc, edits}); // This will trigger a re-render
            }, (error) =>
            {
                window.MC.showError(error, 'Error loading diagram');
            });
        }
    }, [diagramId, activeTab, updateTabs, updateTabName, edits, diagramXml]);

    // TODO Calculate height in a better way
    return activeTab !== tabIndex ? <></> : <div style={{width: '100vw', height: 'calc(100vh - 110px)'}} id={diagramId}/>;
}