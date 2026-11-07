# Hikari Anime

Plugin de providers de anime para o **Nuvio**, baseado nos scrapers do Kamirama, preservando a lógica original de extração sempre que possível.

## Providers

| Provider | Conteúdo | Filtro |
| --- | --- | --- |
| AniZone | Filmes e séries de anime | Somente 1080p com áudio ou legenda identificada em português |
| Berry Animes | Séries de anime | Somente resultados identificados em 1080p |
| Tomato | Séries de anime | Somente resultados identificados em 1080p |

## Instalação no Nuvio

Adicione este manifest na área de plugins:

`https://raw.githubusercontent.com/robertmenezes/hikari-anime/main/manifest.json`

Se o repositório já estiver instalado, atualize/force a atualização do repositório para buscar a nova versão dos providers.

## Formato dos cartões

Os providers AniZone e Berry Animes usam o formato compacto Hikari:

```text
[Hikari] 1080p • AniZone
Daemons of the Shadow Realm - S01E01
Audio: Japanese (Original), Portuguese (Brazil), English, German, +6 more | Subs: Portuguese (Brazil), English, +3 more
```

As listas exibem até quatro idiomas e agrupam os restantes como `+N more`. O idioma original é identificado com base nos metadados do TMDB. Os nomes são apresentados em inglês, seguindo o estilo dos cartões de referência.

## AniZone

- A fonte só é retornada quando encontra pelo menos uma faixa de áudio ou legenda identificada como português.
- `pt-BR` aparece como Portuguese (Brazil), `pt-PT` como Portuguese (Portugal) e `pt` sem região como Portuguese.
- As faixas de legenda separadas são repassadas ao Nuvio para seleção no player.
- A extração considera os idiomas anunciados no manifesto HLS e as legendas externas fornecidas pela página do episódio.

## Berry Animes

- Provider para séries, baseado no scraper do Kamirama.
- O manifesto HLS é analisado separando faixas de áudio e legendas.
- As legendas externas fornecidas pela fonte são repassadas ao Nuvio.
- A fonte requer uma sessão de projeto incorporada no scraper de origem. Se a fonte começar a responder com HTTP 401/403, pode ser necessário atualizar essa sessão a partir do projeto upstream.
- A reprodução é HLS; a compatibilidade com players externos não é anunciada pelo provider.

## Comportamento geral

- Os providers seguem o filtro estrito de 1080p; não há fallback para 720p, 480p ou qualidades inferiores.
- As faixas disponíveis continuam sendo entregues ao Nuvio para seleção durante a reprodução.
- O Tomato mantém sua autenticação automática original; não é necessário inserir token nas configurações do Nuvio.

## Estrutura

```text
.
├── manifest.json
└── providers
    ├── anizone.js
    ├── berryanimes.js
    └── tomato.js
```

## Origem

Os providers foram adaptados dos seguintes arquivos do Kamirama:

- [AniZone](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/anizone.js)
- [Berry Animes](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/berryanimes.js)
- [Tomato](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/tomato.js)

O Hikari Anime não hospeda vídeos ou arquivos de mídia. Os providers consultam fontes de terceiros; utilize-os de acordo com as leis e os termos aplicáveis.
