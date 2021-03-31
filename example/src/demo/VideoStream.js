import { useEffect, useRef } from "react"
import classnames from "classnames"

const VideoStream = ({ stream, id }) => {
    const videoRef = useRef()
    useEffect(() => {
        videoRef.current.srcObject = stream
    }, [])
    return (
        <div className={classnames("img-thumbnail m-1", { "border-primary": "mine" === id })}>
            <video width="100" style={{ "height": "auto" }} ref={videoRef} playsInline autoPlay muted />
        </div>
    )
}

export default VideoStream