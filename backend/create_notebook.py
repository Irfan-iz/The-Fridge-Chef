import nbformat as nbf

nb = nbf.v4.new_notebook()

# Markdown cell: Introduction
md_intro = """# CNN Culinary Assistant Model Training
This notebook trains a Convolutional Neural Network (CNN) to recognize 22 different ingredients for the AI Kitchen Assistant.

**Project:** Bachelor's Degree Final Year Project (FYP) in Artificial Intelligence.
"""
# Code cell: Imports
code_imports = """import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import matplotlib.pyplot as plt
import os
import numpy as np

print("TensorFlow Version:", tf.__version__)"""

# Markdown cell: Load Data
md_load = """## 1. Data Loading
Loading the images from the `dataset` folder using `image_dataset_from_directory`. We use an image size of 224x224, which is common for image classification models."""

code_load = """dataset_dir = 'dataset/train'
val_dir = 'dataset/valid'
test_dir = 'dataset/test'

batch_size = 32
img_height = 224
img_width = 224

train_ds = tf.keras.utils.image_dataset_from_directory(
  dataset_dir,
  seed=123,
  image_size=(img_height, img_width),
  batch_size=batch_size)

val_ds = tf.keras.utils.image_dataset_from_directory(
  val_dir,
  seed=123,
  image_size=(img_height, img_width),
  batch_size=batch_size)

class_names = train_ds.class_names
print("Classes:", class_names)
print("Total classes:", len(class_names))"""

md_viz = """## 2. Data Visualization
Let's visualize a few sample images from our training dataset along with their labels."""

code_viz = """plt.figure(figsize=(10, 10))
for images, labels in train_ds.take(1):
  for i in range(9):
    ax = plt.subplot(3, 3, i + 1)
    plt.imshow(images[i].numpy().astype("uint8"))
    plt.title(class_names[labels[i]])
    plt.axis("off")
plt.show()"""

md_model = """## 3. Model Architecture
Here we define a standard Convolutional Neural Network (CNN) with Data Augmentation to prevent overfitting."""

code_model = """data_augmentation = keras.Sequential(
  [
    layers.RandomFlip("horizontal", input_shape=(img_height, img_width, 3)),
    layers.RandomRotation(0.1),
    layers.RandomZoom(0.1),
  ]
)

num_classes = len(class_names)

model = keras.Sequential([
  data_augmentation,
  layers.Rescaling(1./255),
  layers.Conv2D(16, 3, padding='same', activation='relu'),
  layers.MaxPooling2D(),
  layers.Conv2D(32, 3, padding='same', activation='relu'),
  layers.MaxPooling2D(),
  layers.Conv2D(64, 3, padding='same', activation='relu'),
  layers.MaxPooling2D(),
  layers.Dropout(0.2),
  layers.Flatten(),
  layers.Dense(128, activation='relu'),
  layers.Dense(num_classes, activation='softmax')
])

model.compile(optimizer='adam',
              loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=False),
              metrics=['accuracy'])

model.summary()"""

md_train = """## 4. Training the Model
We will train the model for 15 epochs. You can increase this for better accuracy!"""

code_train = """epochs = 15
history = model.fit(
  train_ds,
  validation_data=val_ds,
  epochs=epochs
)"""

md_graph = """## 5. Training Visualization
Plotting the Accuracy and Loss graphs. These are perfect for your FYP report!"""

code_graph = """acc = history.history['accuracy']
val_acc = history.history['val_accuracy']

loss = history.history['loss']
val_loss = history.history['val_loss']

epochs_range = range(epochs)

plt.figure(figsize=(12, 6))
plt.subplot(1, 2, 1)
plt.plot(epochs_range, acc, label='Training Accuracy')
plt.plot(epochs_range, val_acc, label='Validation Accuracy')
plt.legend(loc='lower right')
plt.title('Training and Validation Accuracy')

plt.subplot(1, 2, 2)
plt.plot(epochs_range, loss, label='Training Loss')
plt.plot(epochs_range, val_loss, label='Validation Loss')
plt.legend(loc='upper right')
plt.title('Training and Validation Loss')
plt.show()"""

md_export = """## 6. Export to TensorFlow Lite
Finally, we save the model to `.tflite` format so it can be deployed on the FastAPI backend!"""

code_export = """converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model = converter.convert()

with open('culinary_assistant_model.tflite', 'wb') as f:
  f.write(tflite_model)
  
print("Model successfully exported to culinary_assistant_model.tflite!")"""

nb['cells'] = [
    nbf.v4.new_markdown_cell(md_intro),
    nbf.v4.new_code_cell(code_imports),
    nbf.v4.new_markdown_cell(md_load),
    nbf.v4.new_code_cell(code_load),
    nbf.v4.new_markdown_cell(md_viz),
    nbf.v4.new_code_cell(code_viz),
    nbf.v4.new_markdown_cell(md_model),
    nbf.v4.new_code_cell(code_model),
    nbf.v4.new_markdown_cell(md_train),
    nbf.v4.new_code_cell(code_train),
    nbf.v4.new_markdown_cell(md_graph),
    nbf.v4.new_code_cell(code_graph),
    nbf.v4.new_markdown_cell(md_export),
    nbf.v4.new_code_cell(code_export)
]

with open('Train_CNN.ipynb', 'w') as f:
    nbf.write(nb, f)
print("Jupyter Notebook created!")
