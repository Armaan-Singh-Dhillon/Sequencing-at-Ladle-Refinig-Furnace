import time
import math
import numpy as np
import cv2
from ultralytics import YOLO
from sort import Sort
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import eventlet

eventlet.monkey_patch()

# Initialize Flask and SocketIO
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Load YOLO model
model = YOLO("best.pt")
classNames = ["Object"]

# Video capture initialization
cap = cv2.VideoCapture("video.mp4")
cap.set(3, 1280)  # Set width
cap.set(4, 720)  # Set height

# Initialize SORT tracker
tracker = Sort()

# Fixed area for intersection
fixed_area = {'x': 530, 'y': 320, 'width': 150, 'height': 400}
threshold = 45000  # Threshold for labeling as intersected
confidence_threshold = 0.8

# Dictionary to track intersection status and total time
intersection_status = {}

# Flask routes


@app.route('/')
def index():
    return "Object Detection Server Running"

# SocketIO events


@socketio.on('connect')
def handle_connect():
    print('Client connected')
    socketio.start_background_task(generate_object_data)



@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')


def put_text(img, text, org, scale=1, thickness=2, color=(0, 255, 0), bgcolor=(0, 0, 0)):
    font = cv2.FONT_HERSHEY_SIMPLEX
    text_size = cv2.getTextSize(text, font, scale, thickness)[0]
    text_w, text_h = text_size
    cv2.rectangle(img, (org[0], org[1] - text_h - 10),
                  (org[0] + text_w, org[1]), bgcolor, -1)
    cv2.putText(img, text, org, font, scale, color, thickness, cv2.LINE_AA)


def get_intersection_area(bbox1, bbox2):
    x1 = max(bbox1['x'], bbox2['x'])
    y1 = max(bbox1['y'], bbox2['y'])
    x2 = min(bbox1['x'] + bbox1['width'], bbox2['x'] + bbox2['width'])
    y2 = min(bbox1['y'] + bbox1['height'], bbox2['y'] + bbox2['height'])

    width = max(0, x2 - x1)
    height = max(0, y2 - y1)

    return width * height


def generate_object_data():
    while True:
        success, img = cap.read()

        if not success:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        results = model(img, stream=True)
        detections = []

        for r in results:
            boxes = r.boxes
            for box in boxes:
                conf = math.ceil((box.conf[0] * 100)) / 100

                if conf > confidence_threshold:
                    x1, y1, x2, y2 = box.xyxy[0]
                    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                    detections.append([x1, y1, x2, y2, conf])
                    cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 255), 2)

                    cls = int(box.cls[0])
                    class_name = classNames[cls]
                    label = f'{class_name} {conf}'
                    cv2.putText(img, label, (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 2)

                    yolo_bbox = {'x': x1, 'y': y1,
                                 'width': x2 - x1, 'height': y2 - y1}
                    intersection_area = get_intersection_area(
                        yolo_bbox, fixed_area)

                    if intersection_area > threshold:
                        cv2.putText(img, 'Intersected', (x1, y1 + 20),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        trackers = tracker.update(np.array(detections))

        for track in trackers:
            x1, y1, x2, y2, track_id = track
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

            cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 3)
            put_text(img, f'ID: {int(track_id)}', (x1, y1 - 10))

            yolo_bbox = {'x': x1, 'y': y1, 'width': x2 - x1, 'height': y2 - y1}
            intersection_area = get_intersection_area(yolo_bbox, fixed_area)

            if track_id not in intersection_status:
                intersection_status[track_id] = {
                    'intersecting': False,
                    'total_time': 0,
                    'enter_time': None
                }

            if intersection_area > threshold:
                if not intersection_status[track_id]['intersecting']:
                    intersection_status[track_id]['intersecting'] = True
                    intersection_status[track_id]['enter_time'] = time.time()
            else:
                if intersection_status[track_id]['intersecting']:
                    intersection_status[track_id]['intersecting'] = False
                    if intersection_status[track_id]['enter_time'] is not None:
                        intersection_status[track_id]['total_time'] += time.time(
                        ) - intersection_status[track_id]['enter_time']
                        intersection_status[track_id]['enter_time'] = None

                cv2.putText(img, 'Intersected', (x1, y2 + 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

            # Display total time as a label
            total_time_str = f"Total Time: {intersection_status[track_id]['total_time']:.2f} seconds"
            put_text(img, total_time_str, (x1, y1 - 30))

        cv2.rectangle(img, (fixed_area['x'], fixed_area['y']),
                      (fixed_area['x'] + fixed_area['width'],
                       fixed_area['y'] + fixed_area['height']),
                      (0, 0, 255), 2)

        print(intersection_status)

        # Emit object data to connected clients
        for track_id, status_data in intersection_status.items():
            object_data = {
                'track_id': track_id,
                'intersecting': status_data['intersecting'],
                'total_time': status_data['total_time']
            }
            socketio.emit('object_data', object_data)
            eventlet.sleep(0)

        cv2.imshow("Image", img)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == '__main__':
    print("Starting server...")
    socketio.run(app, host='0.0.0.0', port=4999)
