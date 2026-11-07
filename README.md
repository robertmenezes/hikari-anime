# Hikari Anime

Plugin de providers para o Nuvio, com fontes de anime e fontes gerais de filmes e séries. Os providers mantêm cartões Hikari compactos e priorizam a apresentação de idiomas para o público latino-americano.

## Providers

| Provider | Conteúdo | Filtro / comportamento |
| --- | --- | --- |
| AniZone | Filmes e séries de anime | Somente 1080p com áudio ou legenda identificada em português |
| Berry Animes | Séries de anime | Somente resultados identificados em 1080p |
| Tomato | Séries de anime | Somente resultados identificados em 1080p |
| MovieBox | Filmes e séries | HLS, DASH e MP4; variantes de áudio e legendas externas |
| MovieBox IN | Filmes e séries | Mesmo fluxo de reprodução, priorizando o host regional IN |

## Instalação no Nuvio

Adicione este manifesto na área de plugins:

https://raw.githubusercontent.com/robertmenezes/hikari-anime/main/manifest.json

Se o repositório já estiver instalado, atualize/force a atualização para buscar a nova versão dos providers.

## Cartões e idiomas

AniZone e Berry Animes usam cartões compactos Hikari, com qualidade, provider, título e informações de áudio/legendas. Os idiomas são apresentados em português sempre que identificados; português e espanhol recebem prioridade na descrição.

## AniZone

- A fonte só é retornada quando encontra pelo menos uma faixa de áudio ou legenda identificada como português.
- As faixas de legenda separadas são repassadas ao Nuvio para seleção no player.
- A extração considera os idiomas anunciados no manifesto HLS e as legendas externas fornecidas pela página do episódio.

## Berry Animes

- Provider para séries, baseado no scraper do Kamirama.
- O manifesto HLS é analisado separando faixas de áudio e legendas, reconhecendo códigos ISO 639-1 e ISO 639-2/3.
- As legendas externas fornecidas pela fonte são repassadas ao Nuvio.
- A reprodução é HLS; a compatibilidade com players externos não é anunciada pelo provider.

## Tomato

- Provider de séries de anime que mantém o fluxo original do scraper.
- A autenticação é automática; não é necessário inserir token nas configurações do Nuvio.

## MovieBox e MovieBox IN

- Os dois providers aceitam filmes e séries e recebem do Nuvio o TMDB ID, o tipo de mídia e, para séries, temporada e episódio.
- A pesquisa considera título, título original, tipo de conteúdo e ano para reduzir correspondências incorretas.
- As variantes de áudio/dublagem são consultadas separadamente quando a API as disponibiliza.
- Os resultados podem incluir HLS, DASH, MP4 ou MKV, com qualidade, cabeçalhos de reprodução e legendas externas quando disponíveis.
- A autenticação usa a assinatura da API móvel e obtém um token anônimo durante a consulta. Não é necessário cadastrar uma chave ou token nas configurações do plugin.
- MovieBox prioriza api3.aoneroom.com; MovieBox IN prioriza apig.inmoviebox.com. As rotas de busca e reprodução encontradas nos pacotes são praticamente iguais, então as duas variantes podem retornar alguns links idênticos. A diferença mais evidente nos pacotes originais está nas páginas de catálogo.
- As fontes não aplicam o filtro estrito de 1080p dos providers de anime; as qualidades encontradas são entregues em ordem decrescente para que o usuário escolha.

## Comportamento geral

- AniZone, Berry Animes e Tomato mantêm o filtro estrito de 1080p.
- MovieBox e MovieBox IN retornam as qualidades disponíveis, ordenadas da maior para a menor.
- As faixas de áudio e as legendas externas identificadas continuam sendo entregues ao Nuvio para seleção durante a reprodução.

## Estrutura

```
.
├── manifest.json
└── providers
    ├── anizone.js
    ├── berryanimes.js
    ├── moviebox.js
    ├── movieboxin.js
    └── tomato.js
```

## Origem e referências

Os providers de anime foram adaptados dos seguintes arquivos do Kamirama:

- AniZone: https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/anizone.js
- Berry Animes: https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/berryanimes.js
- Tomato: https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/tomato.js

A integração MovieBox foi implementada para o runtime de plugins do Nuvio com base no comportamento observado nos pacotes Cloudstream fornecidos para análise e em referências públicas da API móvel. O Hikari não importa a infraestrutura do Stremio ou a do Cloudstream.

O Hikari Anime não hospeda vídeos ou arquivos de mídia. Os providers consultam fontes de terceiros; utilize-os de acordo com as leis e os termos aplicáveis.
