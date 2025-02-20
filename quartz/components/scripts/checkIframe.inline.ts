if (window.self !== window.top) {
    console.log("in iframe");
    document.getElementById("quartz-root")?.classList.add("in-iframe");

    const head = document.getElementsByTagName("head")[0];
    const baseTag = document.createElement("base");
    baseTag.setAttribute("target", "_parent");
    head.appendChild(baseTag);
}
