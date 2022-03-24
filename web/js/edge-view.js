import Mustache from "mustache"
import { post, del } from "./rest-api"
import { hashColor } from "./label-colors"
import render from "./render"

/**
 * Delete an edge.
 * 
 * @param {*} graph 
 * @param {*} edge 
 */
async function deleteEdge(graph, edge) {
    const deleteResult = await del("edge-delete", edge.id, graph.partition)
    console.log(deleteResult)

    // Remove the edge
    let indexToDelete = -1
    for (let i = 0; i < graph.data.edges.length; i++) {
        let edgeToDelete = graph.data.edges[i]
        if (edgeToDelete.id === edge.id) {
            indexToDelete = i
            break
        }
    }
    if (indexToDelete > -1) {
        graph.data.edges.splice(indexToDelete, 1)
    }

    // Re-render the canvas
    render(graph)

    // Reset the property view to blank
    viewEdge(graph, null)
}

let edgeViewTemplate

/**
 * View edge details in the left bar.
 * 
 * @param {*} edge 
 */
async function viewEdge(graph, edge) {
    // Clear the current info
    document.getElementById("props").innerHTML = ""

    if (!edge) {
        return
    }

    if (!edge.properties) edge.properties = {}

    // Get the template
    if (!edgeViewTemplate) {
        edgeViewTemplate = await (await fetch("/tmpl/edge-view.html?r=" + Math.random())).text()
    }

    const view = Object.assign({}, edge)

    view.to = graph.nodes.get(edge.to).properties.name
    view.from = graph.nodes.get(edge.from).properties.name

    // Put the properties into an array of key value pairs for the template
    if (view.properties && !view.kv) {
        view.kv = []
        for (const p in edge.properties) {
            if (p === "_partition") continue // Don't display partition strategy property
            view.kv.push({
                key: p,
                value: edge.properties[p],
            })
        }
    } 

    console.log("edge view: ", view)

    const rendered = Mustache.render(edgeViewTemplate, view)

    document.getElementById("props").innerHTML = rendered

    // Set up an event handler for deleting properties
    for (const keyval of view.kv) {
        (function (k) {
            const el = document.getElementById(`prop-x-${keyval.key}`)
            el.addEventListener("click", async function () {
                console.log(`About to delete ${k}`)
                delete edge.properties[k]
                const edgeResult = await post("edge-post", edge, graph.partition)
                console.log(edgeResult)
                viewEdge(graph, edge)
            })
        }(keyval.key))
    }

    // Set up an event handler for adding properties
    const addButton = document.getElementById("btn-add-prop")
    addButton.addEventListener("click", async function () {
        const txtKey = document.getElementById("txt-prop-name")
        const txtVal = document.getElementById("txt-prop-value")
        edge.properties[txtKey.value] = txtVal.value
        const edgeResult = await post("edge-post", edge, graph.partition)
        console.log(edgeResult)
        viewEdge(graph, edge)
    })

    // Set up an event handler to delete an edge
    const deleteButton = document.getElementById("btn-delete-edge")
    deleteButton.onclick = async () => { deleteEdge(graph, edge) }
}


export default viewEdge
