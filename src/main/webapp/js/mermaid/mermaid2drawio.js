mxMermaidToDrawio = function(graph, diagramtype)
{
    if (mxMermaidToDrawio.listeners.length == 0) return;

    console.log('mermaidToDrawio', graph, diagramtype);

    try
    {
        return convertDiagram(graph, diagramtype);
    }
    catch (e)
    {
        console.log('mermaidToDrawio', e);
    }

    function createMxGraph()
    {
        var graph = new Graph();
        graph.setExtendParents(false);
        graph.setExtendParentsOnAdd(false);
        graph.setConstrainChildren(false);
        graph.setHtmlLabels(true);
        graph.getModel().maintainEdgeParent = false;
        return graph;
    };

    function formatLabel(label, type)
    {
        return (label? label.replace(/\\n/g, '\n').replace(/<br>/gi, '\n').replace(/~(.+)~/g, '<$1>') : '') + 
            (type ? '<' + type + '>' : '');
    }

    function simpleShape(style, node, parent, mxGraph)
    {
        return mxGraph.insertVertex(parent , null, formatLabel(node.labelText), node.x, node.y, node.width, node.height, style);
    }

    function fixNodePos(node)
    {
        node.x -= node.width/2;
        node.y -= node.height/2;
    }

    // TODO Add styles if needed
    function addNode(node, parent, mxGraph)
    {
        var v;
        fixNodePos(node);
        
        if (node.clusterNode)
        {
            node.shape = node.clusterData.shape;
            node.labelText = node.clusterData.labelText;
            node.type = node.clusterData.type;
        }

        switch (node.shape)
        {
            case 'class_box':
                var members = node.classData.members;
                var methods = node.classData.methods;
                var annotations = node.classData.annotations || [];
                var annotationsStr = '';

                for (var i = 0; i < annotations.length; i++)
                {
                    annotationsStr += '<<' + formatLabel(annotations[i]) + '>>\n';
                }

                var rowCount = 1 + (annotations.length / 2) + Math.max(members.length, 0.5) + Math.max(methods.length, 0.5);
                var rowHeight = (node.height - 8) / rowCount; // 8 is separator line height
                
                v = mxGraph.insertVertex(parent, null, annotationsStr + formatLabel(node.labelText, node.type), node.x, node.y, node.width, node.height, 'swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;horizontal=1;startSize=' + (rowHeight * (1 + annotations.length / 2)) + ';horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;');
                var y = rowHeight + (members.length == 0? rowHeight / 2 : 0);

                for (var i = 0; i < members.length; i++)
                {
                    mxGraph.insertVertex(v, null, formatLabel(members[i]), 0, y, node.width, rowHeight, 'text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;');
                    y += rowHeight;
                }

                mxGraph.insertVertex(v, null, null, 0, y, node.width, methods.length == 0? rowHeight / 2 : 8, 'line;strokeWidth=1;fillColor=none;align=left;verticalAlign=middle;spacingTop=-1;spacingLeft=3;spacingRight=3;rotatable=0;labelPosition=right;points=[];portConstraint=eastwest;strokeColor=inherit;');
                y += 8;

                for (var i = 0; i < methods.length; i++)
                {
                    mxGraph.insertVertex(v, null, formatLabel(methods[i]), 0, y, node.width, rowHeight, 'text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;');
                    y += rowHeight;
                }
            break;
            case 'note':
                v = simpleShape('align=left;spacingLeft=4;', node, parent, mxGraph);
            break;
            case 'rect':
                v = simpleShape((node.type == 'round' ? 'rounded=1;absoluteArcSize=1;arcSize=14;' : '') + 
                        'whiteSpace=wrap;strokeWidth=2;' + 
                        (node.type == 'group'? 'verticalAlign=top;' : ''), node, parent, mxGraph);
            break;
            case 'question':
                v = simpleShape('rhombus;strokeWidth=2;whiteSpace=wrap;', node, parent, mxGraph);
            break;
            case 'stadium':
                v = simpleShape('rounded=1;whiteSpace=wrap;arcSize=50;strokeWidth=2;', node, parent, mxGraph);
            break;
            case 'subroutine':
                v = simpleShape('strokeWidth=2;shape=process;whiteSpace=wrap;size=0.04;', node, parent, mxGraph);
            break;
            case 'cylinder':
                v = simpleShape('shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=10;strokeWidth=2;whiteSpace=wrap;', node, parent, mxGraph);
            break;
            case 'circle':
                v = simpleShape('ellipse;aspect=fixed;strokeWidth=2;whiteSpace=wrap;', node, parent, mxGraph);
            break;
            case 'rect_left_inv_arrow':
                v = simpleShape('shape=mxgraph.arrows2.arrow;dy=0;dx=0;notch=20;strokeWidth=2;whiteSpace=wrap;', node, parent, mxGraph);
            break;
            case 'trapezoid':
                v = simpleShape('shape=trapezoid;perimeter=trapezoidPerimeter;fixedSize=1;strokeWidth=2;whiteSpace=wrap;', node, parent, mxGraph);
            break;
            case 'inv_trapezoid':
                v = simpleShape('shape=trapezoid;perimeter=trapezoidPerimeter;fixedSize=1;strokeWidth=2;whiteSpace=wrap;flipV=1;', node, parent, mxGraph);
            break;
            case 'lean_right':
                v = simpleShape('shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;strokeWidth=2;whiteSpace=wrap;', node, parent, mxGraph);
            break;
            case 'lean_left':
                v = simpleShape('shape=parallelogram;perimeter=parallelogramPerimeter;fixedSize=1;strokeWidth=2;whiteSpace=wrap;flipH=1;', node, parent, mxGraph);
            break;
            case 'doublecircle':
                v = simpleShape('ellipse;shape=doubleEllipse;aspect=fixed;strokeWidth=2;whiteSpace=wrap;', node, parent, mxGraph);
            break;
            case 'hexagon':
                v = simpleShape('shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;strokeWidth=2;whiteSpace=wrap;', node, parent, mxGraph);
            break;
            
        }

        //Links
        if (node.link)
        {
            mxGraph.setAttributeForCell(v, 'link', node.link);
        }

        if (node.linkTarget)
        {
            mxGraph.setAttributeForCell(v, 'linkTarget', node.linkTarget);
        }

        if (node.tooltip)
        {
            mxGraph.setAttributeForCell(v, 'tooltip', node.tooltip);
        }

        return v;
    };

    function getEdgeHead(type, prefex)
    {
        switch (type)
        {
            case 'extension':
                return prefex + 'Arrow=block;' + prefex + 'Size=16;' + prefex + 'Fill=0';
            case 'composition':
                return prefex + 'Arrow=diamondThin;' + prefex + 'Size=14;' + prefex + 'Fill=1';
            case 'aggregation':
                return prefex + 'Arrow=diamondThin;' + prefex + 'Size=14;' + prefex + 'Fill=0';
            case 'dependency':
                return prefex + 'Arrow=open;' + prefex + 'Size=12';
            case 'arrow_point':
                return prefex + 'Arrow=block';
            case 'arrow_open':
            case 'none':
                return prefex + 'Arrow=none';
            case 'arrow_circle':
                return prefex + 'Arrow=oval;' + prefex + 'Size=10;' + prefex + 'Fill=1';
            case 'arrow_cross':
                return prefex + 'Arrow=cross';
        }
    };

    function getEdgeStyle(edgeInfo)
    {
        var style = ['curved=1'];

        switch (edgeInfo.pattern)
        {
            case 'dotted':
                style.push('dashed=1;dashPattern=2 3');
            break;
            case 'dashed':
                style.push('dashed=1');
            break;
        }
        
        style.push(getEdgeHead(edgeInfo.arrowTypeStart, 'start'));
        style.push(getEdgeHead(edgeInfo.arrowTypeEnd, 'end'));

        if (edgeInfo.thickness == 'thick')
        {
            style.push('strokeWidth=3');
        }

        return style.join(';');
    };

    function addEdge(edge, edgeInfo, nodesMap, parent, mxGraph)
    {
        var source = nodesMap[edgeInfo.fromCluster || edge.v];
        var target = nodesMap[edgeInfo.toCluster || edge.w];
        var e = mxGraph.insertEdge(parent, null, formatLabel(edgeInfo.label), source, target, getEdgeStyle(edgeInfo));

        if (edgeInfo.startLabelRight)
        {
            var subLbl = mxGraph.insertVertex(e, null, formatLabel(edgeInfo.startLabelRight), -1, 0, 0, 0, 'edgeLabel;resizable=0;align=left;verticalAlign=top;');
            subLbl.geometry.relative = true;
        }

        if (edgeInfo.endLabelLeft)
        {
            var subLbl = mxGraph.insertVertex(e, null, formatLabel(edgeInfo.endLabelLeft), 0.5, 0, 0, 0, 'edgeLabel;resizable=0;align=right;verticalAlign=top;');
            subLbl.geometry.relative = true;
        }

        e.geometry.points = [];

        // Clustom edge points are not supported yet as they are weird
        if (edgeInfo.fromCluster || edgeInfo.toCluster)
        {
            edgeInfo.points = null;
        }

        for (var i = 0; edgeInfo.points && i < edgeInfo.points.length; i++)
        {
            var pt = edgeInfo.points[i];
            e.geometry.points.push(new mxPoint(pt.x, pt.y));
        }
        return e;
    };

    function convertGraph(graph, parent, mxGraph)
    {
        var nodes = graph._nodes, nodesMap = {};
        var edges = graph._edgeObjs;
        var edgesInfo = graph._edgeLabels;
        // TODO Add support for _parent (issue: Edge is not added to subgraph)

        for (var id in nodes)
        {
            nodesMap[id] = addNode(nodes[id], parent, mxGraph);

            if (nodes[id].clusterNode)
            {
                delete nodes[id].graph._nodes[id]; // The same node is added to subgraph also
                convertGraph(nodes[id].graph, nodesMap[id], mxGraph);
            }
        }

        for (var id in edges)
        {
            addEdge(edges[id], edgesInfo[id], nodesMap, parent, mxGraph);
        }
    };

    function convertDiagram(graph, type)
    {
        var mxGraph = createMxGraph();

        convertGraph(graph, null, mxGraph);

        var codec = new mxCodec();
        var node = codec.encode(mxGraph.getModel());
        var modelString = mxUtils.getXml(node);
        console.log(modelString);

        for (var i = 0; i < mxMermaidToDrawio.listeners.length; i++)
        {
            mxMermaidToDrawio.listeners[i](modelString);
        }

        // Reset listeners
        mxMermaidToDrawio.listeners = [];
    }
};

mxMermaidToDrawio.listeners = [];

mxMermaidToDrawio.addListener = function(fn)
{
    mxMermaidToDrawio.listeners.push(fn);
}