import easyocr

reader = easyocr.Reader(['en'])

def detect_name(image_path):
    result = reader.readtext(image_path)
    if not result:
        return "Unknown"
    result.sort(key=lambda x: x[2], reverse=True)
    return result[0][1]