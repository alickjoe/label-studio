export default {
  enableHotkeys: {
    newUI: {
      title: "标注快捷键",
      description: "启用快捷键快速选择标签",
    },
    description: "启用标注快捷键",
    onChangeEvent: "toggleHotkeys",
    defaultValue: true,
  },
  enableTooltips: {
    newUI: {
      title: "在工具提示中显示快捷键",
      description: "在工具和操作的工具提示中显示快捷键绑定",
    },
    description: "显示快捷键工具提示",
    onChangeEvent: "toggleTooltips",
    checked: "",
    defaultValue: false,
  },
  enableLabelTooltips: {
    newUI: {
      title: "在标签上显示快捷键",
      description: "在标签上显示快捷键绑定",
    },
    description: "显示标签快捷键工具提示",
    onChangeEvent: "toggleLabelTooltips",
    defaultValue: true,
  },
  showLabels: {
    newUI: {
      title: "显示区域标签",
      description: "显示区域标签名称",
    },
    description: "在区域中显示标签",
    onChangeEvent: "toggleShowLabels",
    defaultValue: false,
  },
  continuousLabeling: {
    newUI: {
      title: "创建区域后保持标签选中",
      description: "允许使用选中的标签连续创建区域",
    },
    description: "创建区域后保持标签选中",
    onChangeEvent: "toggleContinuousLabeling",
    defaultValue: false,
  },
  selectAfterCreate: {
    newUI: {
      title: "创建后选中区域",
      description: "自动选中新创建的区域",
    },
    description: "创建后选中区域",
    onChangeEvent: "toggleSelectAfterCreate",
    defaultValue: false,
  },
  showLineNumbers: {
    newUI: {
      tags: "Text Tag",
      title: "显示行号",
      description: "识别和引用文档中特定的文本行",
    },
    description: "为文本显示行号",
    onChangeEvent: "toggleShowLineNumbers",
    defaultValue: false,
  },
  preserveSelectedTool: {
    newUI: {
      tags: "Image Tag",
      title: "保持选中工具",
      description: "在任务间保持选中的工具",
    },
    description: "记住选中的工具",
    onChangeEvent: "togglepreserveSelectedTool",
    defaultValue: true,
  },
  enableSmoothing: {
    newUI: {
      tags: "Image Tag",
      title: "缩放时像素平滑",
      description: "放大时平滑图像像素",
    },
    description: "缩放时启用图像平滑",
    onChangeEvent: "toggleSmoothing",
    defaultValue: true,
  },
  invertedZoom: {
    newUI: {
      tags: "Image Tag",
      title: "反转缩放方向",
      description: "反转滚动缩放的方向",
    },
    description: "启用反转缩放方向",
    onChangeEvent: "toggleInvertedZoom",
    defaultValue: false,
  },
};
