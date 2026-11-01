---
title: "Testcontainers"
short: "Testcontainers"
teaser: "Docker-basiertes Testing-Framework für Datenbanken und Services während der Testausführung."
material: "ops"
order: 1
youtube: "LYnmbkBfeZA"
date: "2023-02-22"
recording: "freitagsfruehstueck"
---

[Testcontainers](https://testcontainers.com/) ist ein Framework, mit dem man im Test echte Datenbanken oder andere Dienste nutzen kann, die während der Testausführung in Containern laufen.

Testcontainers nutzt dafür [Docker](https://www.docker.com/).

## Vorteile

* Es wird automatisch ein freier Port gesucht und genutzt
* Der Sidecar-Container [Ryuk](https://hub.docker.com/r/testcontainers/ryuk) räumt die Container anschließend wieder ab
* Testcontainers gibt es inzwischen für alle gängigen Programmiersprachen
