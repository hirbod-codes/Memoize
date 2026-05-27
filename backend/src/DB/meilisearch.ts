import { meili } from ".."

export const MEILI_TREE_NODE = 'tree_node'
export const MEILI_LEAF = 'leaf'

export async function setupSearch() {
    await meili.deleteIndex(MEILI_TREE_NODE)
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

    await meili.deleteIndex(MEILI_LEAF)
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
