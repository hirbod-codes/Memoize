import { meili } from ".."

export const MEILI_TREE_NODE = 'tree_node'
export const MEILI_LEAF = 'leaf'

export async function setupSearch() {
    console.log('Meilisearch setup...')

    console.log('Create MEILI_TREE_NODE index...')
    try {
        await meili.createIndex(MEILI_TREE_NODE, { primaryKey: '_id' })
    } catch (err) {
        console.log('Index probably already exists')
        console.error(err);
    }

    console.log('Prepare MEILI_TREE_NODE index...')
    const treeNodeIndex = meili.index(MEILI_TREE_NODE)
    await treeNodeIndex.updateFilterableAttributes([
        'userId',
        'parentId'
    ])
    await treeNodeIndex.updateSortableAttributes([
        '_id',
        'updatedAt',
        'createdAt',
    ])
    await treeNodeIndex.updateSearchableAttributes([
        'title'
    ])

    console.log('Create MEILI_LEAF index...')
    try {
        await meili.createIndex(MEILI_LEAF, { primaryKey: '_id' })
    } catch (err) {
        console.log('Index probably already exists')
        console.error(err);
    }

    console.log('Prepare MEILI_LEAF index...')
    const leafIndex = meili.index(MEILI_LEAF)
    await leafIndex.updateFilterableAttributes([
        'userId',
        'treeNodeId'
    ])
    await leafIndex.updateSortableAttributes([
        '_id',
        'updatedAt',
        'createdAt',
    ])
    await leafIndex.updateSearchableAttributes([
        'title'
    ])
}
