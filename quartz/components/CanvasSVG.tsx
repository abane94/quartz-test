// @ts-ignore
import checkIframeScript from "./scripts/checkIframe.inline"
import inIframeStyle from "./styles/InIframe.scss"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

const CanvasSVG: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    return <div id="quartz-body">{fileData.text}</div>
}

CanvasSVG.afterDOMLoaded = checkIframeScript
CanvasSVG.css = inIframeStyle

export default (() => CanvasSVG) satisfies QuartzComponentConstructor
