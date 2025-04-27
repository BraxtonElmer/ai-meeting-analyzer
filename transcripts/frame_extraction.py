import cv2

def extract_frame(video_path, timestamp, output_image_path):
    cap = cv2.VideoCapture(video_path)
    cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
    ret, frame = cap.read()
    if ret:
        cv2.imwrite(output_image_path, frame)
    cap.release()