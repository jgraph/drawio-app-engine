import React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import mondaySdk from "monday-sdk-js";
import "monday-ui-react-core/dist/main.css";
import { Flex, Button, TabList, Tab, TabPanels, TabPanel, AttentionBox } from "monday-ui-react-core";
import GraphViewerCmp from "./GraphViewerCmp.js";

const monday = mondaySdk();

const App = () => {
  const [diagrams, setDiagrams] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const isReady = useRef(false);
  const isDashboard = useRef(false);

  const isSketch = window.MC.getUrlParam('sketch') === '1';
  
  const updateTabs = useCallback((newActiveTab) => {
    const fillDiagrams = (diagrams) => {
      const filteredDiagrams = diagrams.filter((diagram) => !diagram.isDeleted);
      setDiagrams(filteredDiagrams);
      isReady.current = true;

      if (newActiveTab != null)
      {
        setActiveTab(newActiveTab === 'last'? filteredDiagrams.length -1 : newActiveTab);
      }
    };

    // Fetch diagrams list
    window.MC.getDiagramList(fillDiagrams, (error) => {
      window.MC.showError(error);
      fillDiagrams([]);
    });
  }, []);

  const updateTabName = useCallback((diagramIndex, newName) => 
  {
    diagrams[diagramIndex].name = newName;
    setDiagrams([...diagrams]);
  }, [diagrams]);

  useEffect(() => 
  {
    monday.execute("valueCreatedForUser");
    monday.listen("context", (res) => 
    {
      window.MC.init(res.data, monday);
      isDashboard.current = res.data.instanceType === "dashboard_widget";
      // Adjust theme
      document.body.setAttribute("class", res.data.theme + '-app-theme'); // TODO Is this the correct way to do it?

      // Render diagrams tabs first time context is ready only
      if (!isReady.current)
      {
        updateTabs();
      }
    });
  }, [updateTabs]);

  const createDiagram = () => {
    monday.execute('openAppFeatureModal', { urlPath: window.location.pathname + "editor.html", urlParams:"new=1" + (isSketch? "&sketch=1" : ""),
              height: "100vh", width: "100vw" }).then((res) => {
      updateTabs('last');
    });
  };

  const activateTab = (index) => {
    setActiveTab(index);
  };

  return (
    <div className="App">
      <Flex style={{width: "100%", display: isReady.current? 'none' : ''}} justify={Flex.justify.CENTER}>
        <img src="./images/spinner.gif" alt="loading" />
      </Flex>
      <Flex style={{width: "100%", display: isReady.current && (!isDashboard.current || diagrams.length === 0)? '' : 'none'}} justify={diagrams.length === 0? Flex.justify.CENTER : Flex.justify.END}>
        <Button style={{margin: "5px"}} onClick={createDiagram}>Create { isSketch? 'board' : 'diagram' }</Button>
      </Flex>
      { isDashboard.current? (
        diagrams.length > 0 ? <GraphViewerCmp diagramId={diagrams[0].id} activeTab={0} tabIndex={0} updateTabs={updateTabs} updateTabName={updateTabName}></GraphViewerCmp> : <></>
      )
      : (diagrams.length > 0 ? (
        <div style={{width: "100%"}}>
          <TabList tabType="stretched" activeTabId={activeTab}>
            { diagrams.map((diagram, index) => {
              return <Tab key={diagram.id} onClick={activateTab} active={index === activeTab}>{diagram.name}</Tab>;
            }) }
          </TabList>
          <TabPanels activeTabId={activeTab}>
            { diagrams.map((diagram, index) => {
              return (
              <TabPanel key={diagram.id}>
                <GraphViewerCmp diagramId={diagram.id} activeTab={activeTab} tabIndex={index} updateTabs={updateTabs} updateTabName={updateTabName}></GraphViewerCmp>
              </TabPanel>);
            }) }
          </TabPanels>
        </div>
      ) : (
        <Flex style={{width: "100%", display: isReady.current && !isDashboard.current? '' : 'none'}} justify={Flex.justify.CENTER}>
          <AttentionBox
            title={"No " + (isSketch? 'boards' : 'diagrams') + " yet!"}
            text={"Please click on the \"Create " + (isSketch? 'board' : 'diagram') + "\" button above to create a new " + (isSketch? 'board.' : 'diagram.')}
          />
        </Flex>
      ))}
    </div>
  );
};

export default App;
