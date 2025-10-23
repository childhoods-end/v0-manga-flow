// OpenCV.js type definitions
declare namespace cv {
  class Mat {
    constructor()
    constructor(rows: number, cols: number, type: number)
    constructor(size: Size, type: number)
    delete(): void
    clone(): Mat
    copyTo(dst: Mat, mask?: Mat): void
    convertTo(dst: Mat, rtype: number, alpha?: number, beta?: number): void
    rows: number
    cols: number
    data: Uint8Array | Int8Array | Uint16Array | Int16Array | Int32Array | Float32Array | Float64Array
    data32S: Int32Array
    data32F: Float32Array
    data64F: Float64Array
    channels(): number
    depth(): number
    type(): number
    empty(): boolean
    size(): Size
    static zeros(rows: number, cols: number, type: number): Mat
    static ones(rows: number, cols: number, type: number): Mat
    static eye(rows: number, cols: number, type: number): Mat
  }

  class Size {
    constructor(width: number, height: number)
    width: number
    height: number
  }

  class Point {
    constructor(x: number, y: number)
    x: number
    y: number
  }

  class Scalar {
    constructor(v0: number, v1?: number, v2?: number, v3?: number)
  }

  class Rect {
    constructor(x: number, y: number, width: number, height: number)
    x: number
    y: number
    width: number
    height: number
  }

  class RotatedRect {
    center: Point
    size: Size
    angle: number
  }

  // Core functions
  function imread(imageSource: HTMLImageElement | HTMLCanvasElement | ImageData): Mat
  function imshow(canvasOutput: HTMLCanvasElement | string, mat: Mat): void
  function cvtColor(src: Mat, dst: Mat, code: number, dstCn?: number): void
  function threshold(src: Mat, dst: Mat, thresh: number, maxval: number, type: number): number
  function adaptiveThreshold(src: Mat, dst: Mat, maxValue: number, adaptiveMethod: number, thresholdType: number, blockSize: number, C: number): void
  function GaussianBlur(src: Mat, dst: Mat, ksize: Size, sigmaX: number, sigmaY?: number, borderType?: number): void
  function bilateralFilter(src: Mat, dst: Mat, d: number, sigmaColor: number, sigmaSpace: number, borderType?: number): void
  function Canny(image: Mat, edges: Mat, threshold1: number, threshold2: number, apertureSize?: number, L2gradient?: boolean): void
  function dilate(src: Mat, dst: Mat, kernel: Mat, anchor?: Point, iterations?: number, borderType?: number, borderValue?: Scalar): void
  function erode(src: Mat, dst: Mat, kernel: Mat, anchor?: Point, iterations?: number, borderType?: number, borderValue?: Scalar): void
  function morphologyEx(src: Mat, dst: Mat, op: number, kernel: Mat, anchor?: Point, iterations?: number, borderType?: number, borderValue?: Scalar): void
  function getStructuringElement(shape: number, ksize: Size, anchor?: Point): Mat
  function findContours(image: Mat, contours: MatVector, hierarchy: Mat, mode: number, method: number, offset?: Point): void
  function drawContours(image: Mat, contours: MatVector, contourIdx: number, color: Scalar, thickness?: number, lineType?: number, hierarchy?: Mat, maxLevel?: number, offset?: Point): void
  function boundingRect(points: Mat): Rect
  function minAreaRect(points: Mat): RotatedRect
  function contourArea(contour: Mat, oriented?: boolean): number
  function arcLength(curve: Mat, closed: boolean): number
  function approxPolyDP(curve: Mat, approxCurve: Mat, epsilon: number, closed: boolean): void
  function resize(src: Mat, dst: Mat, dsize: Size, fx?: number, fy?: number, interpolation?: number): void
  function warpAffine(src: Mat, dst: Mat, M: Mat, dsize: Size, flags?: number, borderMode?: number, borderValue?: Scalar): void
  function getRotationMatrix2D(center: Point, angle: number, scale: number): Mat
  function bitwise_not(src: Mat, dst: Mat, mask?: Mat): void
  function bitwise_and(src1: Mat, src2: Mat, dst: Mat, mask?: Mat): void
  function add(src1: Mat, src2: Mat, dst: Mat, mask?: Mat, dtype?: number): void
  function subtract(src1: Mat, src2: Mat, dst: Mat, mask?: Mat, dtype?: number): void
  function mean(src: Mat, mask?: Mat): Scalar
  function matFromImageData(imageData: ImageData): Mat

  class MatVector {
    constructor()
    size(): number
    get(index: number): Mat
    push_back(mat: Mat): void
    delete(): void
  }

  // Constants
  const CV_8U: number
  const CV_8S: number
  const CV_16U: number
  const CV_16S: number
  const CV_32S: number
  const CV_32F: number
  const CV_64F: number
  const CV_8UC1: number
  const CV_8UC3: number
  const CV_8UC4: number

  const COLOR_RGBA2GRAY: number
  const COLOR_RGB2GRAY: number
  const COLOR_GRAY2RGBA: number
  const COLOR_GRAY2RGB: number
  const COLOR_BGR2GRAY: number
  const COLOR_BGRA2GRAY: number

  const THRESH_BINARY: number
  const THRESH_BINARY_INV: number
  const THRESH_TRUNC: number
  const THRESH_TOZERO: number
  const THRESH_TOZERO_INV: number
  const THRESH_OTSU: number
  const ADAPTIVE_THRESH_MEAN_C: number
  const ADAPTIVE_THRESH_GAUSSIAN_C: number

  const MORPH_RECT: number
  const MORPH_CROSS: number
  const MORPH_ELLIPSE: number
  const MORPH_ERODE: number
  const MORPH_DILATE: number
  const MORPH_OPEN: number
  const MORPH_CLOSE: number
  const MORPH_GRADIENT: number
  const MORPH_TOPHAT: number
  const MORPH_BLACKHAT: number

  const RETR_EXTERNAL: number
  const RETR_LIST: number
  const RETR_CCOMP: number
  const RETR_TREE: number

  const CHAIN_APPROX_NONE: number
  const CHAIN_APPROX_SIMPLE: number
  const CHAIN_APPROX_TC89_L1: number
  const CHAIN_APPROX_TC89_KCOS: number

  const INTER_NEAREST: number
  const INTER_LINEAR: number
  const INTER_CUBIC: number
  const INTER_AREA: number
  const INTER_LANCZOS4: number

  const BORDER_CONSTANT: number
  const BORDER_REPLICATE: number
  const BORDER_REFLECT: number
  const BORDER_WRAP: number
  const BORDER_REFLECT_101: number
  const BORDER_TRANSPARENT: number
  const BORDER_DEFAULT: number
  const BORDER_ISOLATED: number

  // Runtime initialization callback
  let onRuntimeInitialized: () => void
}

declare global {
  interface Window {
    cv: typeof cv
  }
}

export = cv
export as namespace cv
