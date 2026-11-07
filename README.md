# Hikari Anime

Plugin de providers de anime para o **Nuvio**, baseado nos scrapers do Kamirama, mantendo a lógica original de extração sempre que possível.

## Providers

| Provider | Conteúdo | Filtro |
| --- | --- | --- |
| AniZone | Filmes e séries de anime | Somente resultados identificados em 1080p e com áudio ou legenda em português |
| Tomato | Séries de anime | Somente resultados identificados em 1080p |

## Instalação no Nuvio

Adicione este manifest na área de plugins:

`https://raw.githubusercontent.com/robertmenezes/hikari-anime/main/manifest.json`

Se o repositório já estiver instalado, atualize/force a atualização do repositório para buscar a nova versão dos providers.

## AniZone

O cartão apresenta as informações em linhas separadas:

- `AniZone · 1080p`
- `Áudio · Japonês (Original), Português (Brasil), Espanhol`
- `Legenda · Português (Brasil), Espanhol`

Os nomes dos idiomas são exibidos em português. A indicação `(Original)` usa o idioma original informado pelo TMDB, não a ordem das faixas na playlist.

Os identificadores de português são preservados: `pt-BR` aparece como Português (Brasil), `pt-PT` como Português (Portugal) e `pt` sem região como Português. O plugin não presume que um idioma `pt` genérico seja brasileiro ou português europeu.

A fonte AniZone só é retornada quando encontra pelo menos uma faixa de áudio ou legenda identificada como português. Se não encontrar português em nenhuma das duas modalidades, a fonte é ocultada dos resultados. A detecção considera as faixas de áudio e legendas declaradas no manifesto HLS, além das legendas externas fornecidas pela página do episódio.

O filtro de qualidade continua estrito: somente resultados identificados em 1080p são exibidos. As faixas disponíveis continuam sendo entregues ao Nuvio para seleção durante a reprodução.

## Comportamento geral

- Os scrapers mantêm a estrutura de extração do Kamirama sempre que possível.
- As opções originais de áudio são preservadas.
- Não existe fallback para 720p, 480p ou qualidades inferiores.
- O Tomato utiliza sua autenticação automática original; não é necessário inserir token nas configurações do Nuvio.

## Estrutura

```text
.
├── manifest.json
└── providers
    ├── anizone.js
    └── tomato.js
```

## Origem

Os providers foram adaptados dos seguintes arquivos do Kamirama:

- [AniZone](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/anizone.js)
- [Tomato](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/tomato.js)

O Hikari Anime não hospeda vídeos ou arquivos de mídia. Os providers consultam fontes de terceiros; utilize-os de acordo com as leis e os termos aplicáveis.
