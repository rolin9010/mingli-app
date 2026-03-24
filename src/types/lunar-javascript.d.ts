declare module 'lunar-javascript' {
  // 该库自带 JS 实现，但在部分环境下可能缺少 TS 类型声明。
  // 为了让本项目在严格 TS 模式下可编译，先用 any 占位。
  export const Solar: any
  export const Lunar: any
}

