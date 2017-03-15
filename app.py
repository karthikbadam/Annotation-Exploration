import sys
import os
import shutil
import time
import traceback
import json
from datetime import datetime

## database and server
import pymongo
from flask import Flask
from flask import request, render_template, send_from_directory, jsonify

from sklearn.cluster import ward_tree
import itertools
import numpy as np
from scipy.cluster import hierarchy
import matplotlib.pyplot as plt

## global variables
CUSTOM_STATIC_DIRECTORY = "/public/"
STATIC_FOLDER = "public"
EMPTY_DATUM = "None"

## setup mongodb access
client = pymongo.MongoClient()
collection_db = client.building.permit

## serve index.html
app = Flask(__name__, static_folder=STATIC_FOLDER, static_path=CUSTOM_STATIC_DIRECTORY)

## TODO: important columns in the dataset -- provide a new set for each dataset
COLS = ["latitude", "longitude", "date", "description"]
meta = {}
clusters = []
clusterData = []
clusterFeatures = []
clusterTree = []


@app.route("/")
def index():
    return app.send_static_file('index.html')


@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('public/js/', path)


@app.route('/css/<path:path>')
def send_css(path):
    return send_from_directory('public/css/', path)


@app.route('/images/<path:path>')
def send_images(path):
    return send_from_directory('public/images/', path)


## wrap return data in a json structure
def wrap_data(query, data):
    msgObject = {}
    msgObject["query"] = query
    msgObject["content"] = data
    return json.dumps(msgObject)


## adjust the datetime variables from ISO strings to python compatible variable
def fix(query):
    if "$and" not in query.keys():
        return query

    for obj in query["$and"]:
        if "date" in obj.keys():
            for date_range in obj["date"]["$in"]:
                date_range = datetime.strptime(date_range, '%Y-%m-%dT%H:%M:%S.%fZ')

        if "$or" in obj.keys():
            for obj2 in obj["$or"]:
                if "date" in obj2.keys():
                    obj2["date"]["$gte"] = datetime.strptime(obj2["date"]["$gte"], '%Y-%m-%dT%H:%M:%S.%fZ')
                    obj2["date"]["$lte"] = datetime.strptime(obj2["date"]["$lte"], '%Y-%m-%dT%H:%M:%S.%fZ')

    return query


def retrieve_data_from_query(query):
    query = fix(query)
    cursor = collection_db.find(query, {"_id": False})

    documents = []

    for document in cursor:
        document["date"] = document["date"].strftime("%c")
        documents.append(document)

    return documents


def create_feature_vectors(query):
    global clusterData, clusterFeatures
    query = fix(query)
    cursor = collection_db.find(query)

    documents = []
    for document in cursor:
        documents.append(document)

    if len(documents) == 0:
        return []

    # # Setting the global clusters variable
    # clusterData = documents
    # clusterFeatures = features

    ## figure out the ranges the first time this clustering is applied
    if len(meta.keys()) == 0:
        for key in COLS:
            if key == "date":
                meta[key] = {}
                meta[key]["type"] = "date"

                temp_q = {key: {"$exists": True}}
                meta[key]["min"] = collection_db.find_one(temp_q, sort=[(key, 1)])[key]
                meta[key]["max"] = collection_db.find_one(temp_q, sort=[(key, -1)])[key]

            elif type(documents[0][key]) is int or type(documents[0][key]) is float:
                meta[key] = {}
                meta[key]["type"] = "number"

                # get range of this dimension for normalization
                temp_q = {}
                temp_q[key] = {"$exists": True}
                meta[key]["min"] = collection_db.find_one(temp_q, sort=[(key, 1)])[key]
                meta[key]["max"] = collection_db.find_one(temp_q, sort=[(key, -1)])[key]

            elif type(documents[0][key]) is str or type(documents[0][key]) is unicode:
                meta[key] = {}
                meta[key]["type"] = "string"
                meta[key]["values"] = collection_db.distinct(key)

    features = []
    for document in documents:
        feature = []
        for key in COLS:
            if meta[key]["type"] == "number":
                if key in document:
                    feature.append((document[key] - meta[key]["min"]) / (meta[key]["max"] - meta[key]["min"]))
                else:
                    feature.append(0.)
            elif meta[key]["type"] == "string":
                for category in meta[key]["values"]:
                    if key in document:
                        if category == document[key]:
                            feature.append(1.)
                        else:
                            feature.append(0.)
                    else:
                        feature.append(0.)
            elif meta[key]["type"] == "date":
                if key in document:
                    feature.append(
                        (document[key] - meta[key]["min"]).total_seconds() / (meta[key]["max"] - meta[key]["min"]).total_seconds())
                else:
                    feature.append(0.)

        features.append(feature)
    return features


# def extract_unique(indices):
#     global clusterData, clusterFeatures
#
#     representatives = []
#     # element with the highest within cluster distance
#     representatives.append(clusterData[0])
#
#
#     # element with lowest within cluster distance
#     representatives.append(clusterData[1])
#
#
#     # element with the longest description
#     representatives.append(clusterData[2])
#
#     return representatives


# @app.route("/annotation", methods=['POST'])
# def get_annotation():
#     try:
#         annotations = request.get_json()
#
#         ## for each cluster
#         ## Find the most distant item for each object -- rank based on score is average distance within cluster
#         ## Regroup
#         ##
#
#         ## Why represent every object, just pick top elements in each cluster and show them
#         # go through the annotations construct the annotation object for each
#         # construct a distance function
#         # construct the hierarchical clustering structure using the scikit-learn
#
#
#         # first extract the text attributes from the dataset to construct an annotation object
#         cols = annotations["cols"];
#         numClusters = annotations["clusters"];
#         filters = annotations["filters"];
#
#         ## get number of clusters to retrieve and number of objects in the data projection
#         clusterLabels = hierarchy.cut_tree(clusters, n_clusters=[numClusters])
#         print (clusterLabels)
#
#         restructuredData = np.array(numClusters);
#
#         for i, label in clusterLabels:
#             if restructuredData[label] == 0:
#                 restructuredData[label] = []
#             else:
#                 restructuredData[label].append(i)
#
#         clusterMeta = []
#         for i in range(0, numClusters):
#             clusterMeta.append(extract_unique(restructuredData[i], filters));
#
#         returnData = {
#             annotations: clusterMeta
#         }
#         return json.dumps(returnData)
#
#     except Exception, e:
#         print "Error: Retrieving Data from MongoDB"
#         return jsonify({'error': str(e), 'trace': traceback.format_exc()})


## read query from client and return data
@app.route("/data", methods=['POST'])
def get_data():
    raw_query = request.get_json()
    try:
        documents = retrieve_data_from_query(raw_query)
        return wrap_data({}, documents)

    except Exception, e:
        print "Error: Retrieving Data from MongoDB"
        return jsonify({'error': str(e), 'trace': traceback.format_exc()})


## run the server app
if __name__ == "__main__":
    ## run feature generation
    features = create_feature_vectors({})

    # TODO: dump to file and read from it rather than wasting time computing again
    clusters = hierarchy.linkage(features, metric='euclidean', method='ward')
    clustersTree = hierarchy.to_tree(clusters)
    cut_tree = hierarchy.cut_tree(clusters, n_clusters=[5])
    print(cut_tree[:10])

    ## now start server
    app.run(host='0.0.0.0', port=3000, debug=True, use_reloader=False)

    ## JUNK code
    # fig, axes = plt.subplots(1, 2, figsize=(16, 12), dpi=180, facecolor='w', edgecolor='k')
    # clusters = hierarchy.linkage(features, metric='euclidean', method='ward')
    # dn1 = hierarchy.dendrogram(clusters, ax=axes[0], orientation='top', leaf_font_size = 1)
    # clusters2 = hierarchy.linkage(features, metric='cosine', method='average')
    # dn2 = hierarchy.dendrogram(clusters2, ax=axes[1], orientation='top', leaf_font_size=1)
    # plt.show()
