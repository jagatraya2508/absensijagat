import ReactDOM from 'react-dom';

export default function ImageModal({ isOpen, onClose, imgSrc, caption }) {
    if (!isOpen) return null;

    // Use Portal to render at the end of body
    return ReactDOM.createPortal(
        <div className="image-modal-overlay">
            <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="image-modal-close" onClick={onClose}>&times;</button>
                <img src={imgSrc} alt={caption || "Preview"} className="image-modal-img" />
                {caption && <div className="image-modal-caption">{caption}</div>}
            </div>
        </div>,
        document.body
    );
}
