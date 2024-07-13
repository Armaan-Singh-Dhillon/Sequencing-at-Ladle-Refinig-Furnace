from ultralytics import YOLO
import cv2
import math

cap = cv2.VideoCapture("video.mp4")  # Path to your video file


# cap = cv2.VideoCapture(0)  # For Webcam
# cap.set(3, 1280)
# cap.set(4, 720)

model = YOLO("best.pt")

classNames = ['Object']


def put_text(img, text, org, scale=1, thickness=2, color=(0, 255, 0), bgcolor=(0, 0, 0)):
    font = cv2.FONT_HERSHEY_SIMPLEX
    text_size = cv2.getTextSize(text, font, scale, thickness)[0]
    text_w, text_h = text_size
    cv2.rectangle(img, (org[0], org[1] - text_h - 10),
                  (org[0] + text_w, org[1]), bgcolor, -1)
    cv2.putText(img, text, org, font, scale, color, thickness, cv2.LINE_AA)


while True:
    success, img = cap.read()
    if not success:
        break

    results = model(img, stream=True)

    for r in results:
        boxes = r.boxes
        for box in boxes:
            # Bounding Box
            x1, y1, x2, y2 = box.xyxy[0]
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            w, h = x2 - x1, y2 - y1

            # Confidence
            conf = math.ceil((box.conf[0] * 100)) / 100
            # Class Name
            cls = int(box.cls[0])
            currentClass = classNames[0]

            if conf > 0.8:
                put_text(img, f'{currentClass} {conf}', (max(0, x1), max(
                    35, y1)), scale=1, thickness=1, color=(0, 255, 0))
                cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 3)

    cv2.imshow("Image", img)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
