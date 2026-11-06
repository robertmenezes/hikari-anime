# Hikari Anime

Plugin de providers de anime para o **Nuvio**, com foco em uma seleção enxuta de fontes e qualidade de vídeo.

## Providers

| Provider | Conteúdo | Qualidade |
| --- | --- | --- |
| AniZone | Filmes e séries de anime | Exclusivamente 1080p |
| Tomato | Séries de anime | Exclusivamente 1080p |

As opções de áudio disponíveis em cada fonte são preservadas. Streams sem identificação confiável de 1080p são descartadas.

## Instalação no Nuvio

1. Abra **Configurações → Conteúdo e descoberta → Plugins**.
2. Escolha **Adicionar repositório**.
3. Informe a URL do manifest:

   `https://raw.githubusercontent.com/robertmenezes/hikari-anime/main/manifest.json`

4. Atualize a lista e habilite AniZone e/ou Tomato.

## Estrutura

```text
.
├── manifest.json
├── README.md
└── providers
    ├── anizone.js
    └── tomato.js
```

## Origem e atribuição

Os arquivos de provider desta versão foram adaptados a partir de:

- [Kamirama-Plugin — AniZone](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/anizone.js)
- [Kamirama-Plugin — Tomato](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/tomato.js)

O upstream consultado não continha um arquivo `LICENSE` na data da preparação desta cópia. Este README registra a origem dos arquivos; não concede permissões adicionais nem declara uma licença para código de terceiros.

## Observações técnicas

- O filtro do AniZone exige que a maior resolução anunciada pela playlist seja exatamente 1080p.
- O Tomato aceita o identificador `FHD` e resoluções explicitamente reconhecidas como 1080p; o rótulo genérico `HD` não é tratado como Full HD.
- O filtro é intencionalmente restritivo: fontes sem informação suficiente de resolução não são exibidas.

O Hikari Anime não hospeda vídeos ou arquivos de mídia. Os providers consultam fontes de terceiros; utilize-os de acordo com as leis e os termos aplicáveis.
