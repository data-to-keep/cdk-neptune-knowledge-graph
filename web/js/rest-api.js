const { APIGATEWAY_URL, LOGIN_URL } = require("./config")
const Cookies = require("js-cookie")
const { setAuthCookies } = require("./auth")
const util = require("util")

/**
 * Common options for fetch requests
 */
const fetchOptions = {
    mode: "cors",
    cache: "no-cache",
    credentials: "same-origin",
    headers: {
        "Content-Type": "application/json",
    },
}

/**
 * Check to see if the response has an error.
 * 
 * @param {*} response 
 */
async function checkError(response) {
    if (response.status === 401) {
        // User is not logged in, send them to Cognito
        console.log("Got a 401 from API Gateway, redirecting to Cognito")
        window.location = LOGIN_URL
        //throw new Error("401")
        return
    }
    if (response.status >= 400 && response.status < 600) {
        console.info("response error", response)
        const txt = await response.text()
        throw new Error("Request failed: " + txt)
    }
}

/**
 * Get the JWT from cookies and add it to headers.
 * 
 * @param {*} options 
 */
async function addAuthHeader(options) {

    let jwt
    if (window.location.hostname === "localhost") {
        jwt = require("./jwt")
        // jwt.js needs a JWT token and we need to be on localhost
        Cookies.set("jwt.id", jwt)
    } 

    jwt = Cookies.get("jwt.id")
    if (!jwt) {
        // User is not logged in
        console.log("Not logged in")

        // Redirect to Cognito
        window.location = LOGIN_URL
        return
    }

    // Refresh the token if it is expired
    const expiration = Cookies.get("jwt.expires")
    if (expiration) {
        const expires = new Date(expiration)
        if (expires < new Date()) {
            const refresh = Cookies.get("jwt.refresh")

            console.log("Refreshing jwt token: " + refresh)

            // Refresh the token
            const data = await get(`jwt-get?refresh=${refresh}`, null, false)
            console.log(util.inspect(data))
            console.log("jwt-get refresh response: " + JSON.stringify(data, null, 0))

            setAuthCookies(data)
            jwt = Cookies.get("jwt.id")
        }
    }

    options.headers.Authorization = "Bearer " + jwt
}

const PARTITION_HEADER = "X-KG-Partition"

/**
 * POST data to a REST API.
 */
async function post(resource, data = {}, partition) {
    const slash = APIGATEWAY_URL.endsWith("/") ? "" : "/"
    const url = APIGATEWAY_URL + slash + resource
    const options = Object.assign({}, fetchOptions)
    options.body = JSON.stringify(data)
    options.method = "POST"
    await addAuthHeader(options)
    options.headers[PARTITION_HEADER] = partition
    const response = await fetch(url, options)
    await checkError(response)
    return response.json()
}

/**
 * Delete a resource by id
 * 
 * @param {*} resource 
 * @param {*} id 
 * @returns 
 */
async function del(resource, id, partition) {
    const slash = APIGATEWAY_URL.endsWith("/") ? "" : "/"
    const url = APIGATEWAY_URL + slash + resource + "/" + id
    const options = Object.assign({}, fetchOptions)
    options.method = "DELETE"
    await addAuthHeader(options)
    options.headers[PARTITION_HEADER] = partition
    const response = await fetch(url, options)
    await checkError(response)
    return response.json()
}

/**
 * Get a resource from the rest api.
 * 
 * @param {*} resource 
 * @param {*} id 
 * @returns 
 */
async function get(resource, id, partition, authorize = false) {
    const slash = APIGATEWAY_URL.endsWith("/") ? "" : "/"
    let url = APIGATEWAY_URL + slash + resource
    if (id) {
        url += ("/" + id)
    }
    const options = Object.assign({}, fetchOptions)
    options.method = "GET"
    if (authorize) {
        await addAuthHeader(options)
    }
    if (partition) {
        options.headers[PARTITION_HEADER] = partition
    }
    const response = await fetch(url, options)
    await checkError(response)
    return response.json()
}

module.exports = { post, del, get }