import type { FC } from "react";
import { getType } from "mobx-state-tree";
import { observer } from "mobx-react";
import { ApartmentOutlined, AudioOutlined, LineChartOutlined, MessageOutlined } from "@ant-design/icons";

import Registry from "../../core/Registry";
import "./Node.prefix.css";
import {
  IconBrushTool,
  IconBrushToolSmart,
  IconCircleTool,
  IconCircleToolSmart,
  IconKeypointsTool,
  IconKeypointsToolSmart,
  IconPolygonTool,
  IconPolygonToolSmart,
  IconRectangle3PointTool,
  IconRectangle3PointToolSmart,
  IconRectangleTool,
  IconRectangleToolSmart,
  IconText,
  IconTimelineRegion,
} from "@humansignal/icons";

interface NodeViewProps {
  name: string;
  icon: any;
  altIcon?: any;
  getContent?: (node: any) => JSX.Element | null;
  fullContent?: (node: any) => JSX.Element | null;
}

const NodeViews: Record<string, NodeViewProps> = {
  // fake view for virtual node representing label group
  LabelModel: {
    name: "",
    icon: () => null,
  },

  RichTextRegionModel: {
    name: "HTML",
    icon: IconText,
    getContent: (node: any) => <span style={{ color: "#5a5a5a" }}>{node.text}</span>,
    fullContent: (node: any) => (
      <div>
        {/* <div style={{ color: "#5a5a5a" }}>{node.text}</div> */}
        <div>{node.start}</div>
        <div>{node.startOffset}</div>
        <div>{JSON.stringify(node.globalOffsets, null, 2)}</div>
      </div>
    ),
  },

  ParagraphsRegionModel: {
    name: "段落",
    icon: IconText,
    getContent: (node) => <span style={{ color: "#5a5a5a" }}>{node.text}</span>,
  },

  AudioRegionModel: {
    name: "音频",
    icon: AudioOutlined,
  },

  TimeSeriesRegionModel: {
    name: "时间序列",
    icon: LineChartOutlined,
  },

  TextAreaRegionModel: {
    name: "输入",
    icon: MessageOutlined,
    getContent: (node) => <span style={{ color: "#5a5a5a" }}>{node._value}</span>,
  },

  RectRegionModel: {
    name: "矩形",
    icon: IconRectangleTool,
    altIcon: IconRectangleToolSmart,
  },

  Rect3PointRegionModel: {
    name: "三点矩形",
    icon: IconRectangle3PointTool,
    altIcon: IconRectangle3PointToolSmart,
  },

  VideoRectangleRegionModel: {
    name: "视频矩形",
    icon: IconRectangleTool,
    altIcon: IconRectangleToolSmart,
    getContent: (node) => <span style={{ color: "#5a5a5a" }}>从 {node.sequence[0]?.frame} 帧</span>,
  },

  VideoVectorRegionModel: {
    name: "视频向量",
    icon: IconPolygonTool,
    altIcon: IconPolygonToolSmart,
    getContent: (node) => <span style={{ color: "#5a5a5a" }}>从 {node.sequence[0]?.frame} 帧</span>,
  },

  PolygonRegionModel: {
    name: "多边形",
    icon: IconPolygonTool,
    altIcon: IconPolygonToolSmart,
  },

  VectorRegionModel: {
    name: "向量",
    icon: IconPolygonTool,
    altIcon: IconPolygonToolSmart,
  },

  EllipseRegionModel: {
    name: "椭圆",
    icon: IconCircleTool,
    altIcon: IconCircleToolSmart,
  },

  // @todo add coords
  KeyPointRegionModel: {
    name: "关键点",
    icon: IconKeypointsTool,
    altIcon: IconKeypointsToolSmart,
  },

  BrushRegionModel: {
    name: "画笔",
    icon: IconBrushTool,
    altIcon: IconBrushToolSmart,
  },

  BitmaskRegionModel: {
    name: "画笔",
    icon: IconBrushTool,
    altIcon: IconBrushToolSmart,
  },

  ChoicesModel: {
    name: "分类",
    icon: ApartmentOutlined,
  },

  TextAreaModel: {
    name: "输入",
    icon: MessageOutlined,
  },

  TimelineRegionModel: {
    name: "时间线段",
    icon: IconTimelineRegion,
  },

  ...Object.fromEntries(
    Registry.customTags.filter((tag) => tag.region).map((tag) => [tag.region.name, tag.region.nodeView]),
  ),
};

const NodeIcon: FC<any> = observer(({ node, ...props }) => {
  const name = useNodeName(node);

  if (!name || !(name in NodeViews)) {
    console.error(`No ${name} in NodeView`);
    return null;
  }

  const { icon: Icon } = NodeViews[name];

  return <Icon {...props} />;
});

const useNodeName = (node: any) => {
  // @todo sometimes node is control tag, not a region
  // @todo and for new taxonomy it can be plain object
  if (!node.$treenode) return null;
  return getType(node).name as keyof typeof NodeViews;
};

export { NodeIcon, NodeViews };
